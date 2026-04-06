"""
Model Fine-Tuning Service

Handles fine-tuning of ML models using collected training data.
Supports both sentiment (RoBERTa) and credibility (BERT-tiny) models.
"""

import asyncio
import logging
import queue
import gc
import threading
from typing import Dict, List, Optional, Literal
from datetime import datetime
from pathlib import Path

logger = logging.getLogger(__name__)

# Model save paths
MODELS_DIR = Path(__file__).parent.parent.parent / "models"
SENTIMENT_MODEL_PATH = MODELS_DIR / "sentiment_finetuned"
CREDIBILITY_MODEL_PATH = MODELS_DIR / "credibility_finetuned"


class ModelFineTuningService:
    """
    Service for fine-tuning HuggingFace models with user feedback data.
    
    Supports:
    - Sentiment: cardiffnlp/twitter-roberta-base-sentiment-latest
    - Credibility: mrm8488/bert-tiny-finetuned-fake-news-detection
    """
    
    # Label mappings
    SENTIMENT_LABEL_MAP = {
        "Positive": 2,
        "Neutral": 1,
        "Negative": 0,
    }
    
    CREDIBILITY_LABEL_MAP = {
        "REAL": 0,
        "FAKE": 1,
    }
    
    @staticmethod
    def _ensure_models_dir():
        """Create models directory if it doesn't exist."""
        MODELS_DIR.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def _prepare_training_output_dir(model_type: Literal["sentiment", "credibility"], run_job_id: str) -> Path:
        """Create an isolated per-job checkpoint directory used by Trainer."""
        import shutil

        train_output_dir = MODELS_DIR / "training_runs" / run_job_id / model_type
        if train_output_dir.exists():
            shutil.rmtree(train_output_dir, ignore_errors=True)
        train_output_dir.mkdir(parents=True, exist_ok=True)
        return train_output_dir

    @staticmethod
    def _cleanup_training_output_dir(path: Path, model_type: str, run_job_id: str) -> None:
        """Best-effort cleanup of temporary training checkpoint directories."""
        import shutil

        try:
            if path.exists():
                shutil.rmtree(path, ignore_errors=True)
        except Exception as e:
            logger.warning(
                f"[FINE-TUNE] Failed to clean temporary {model_type} checkpoints for {run_job_id}: {str(e)}"
            )

    @staticmethod
    def _release_runtime_handles(model_type: str) -> None:
        """Release runtime-cached inference models to avoid Windows mapped-file write locks."""
        import torch
        from app.services.model_manager import model_manager

        model_manager.invalidate_model_cache(model_type)
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

    @staticmethod
    async def _reload_runtime_model(model_type: str, run_job_id: str) -> None:
        """Reload runtime inference model after successful fine-tuned artifact replacement."""
        from app.services.model_manager import model_manager

        try:
            reloaded = await model_manager.reload_model(model_type)
            if not reloaded:
                logger.warning(
                    f"[FINE-TUNE] Runtime {model_type} model reload returned empty for job {run_job_id}"
                )
        except Exception as e:
            logger.warning(f"[FINE-TUNE] Runtime {model_type} model reload failed for {run_job_id}: {str(e)}")

    @staticmethod
    def _save_model_to_temp_then_replace(
        trainer,
        tokenizer,
        target_dir: Path,
        model_type: str,
        run_job_id: str,
    ) -> None:
        """Persist model artifacts via temporary directory then replace live directory atomically as possible."""
        import shutil
        import torch
        import time

        max_save_retries = 6
        for attempt in range(1, max_save_retries + 1):
            attempt_root = MODELS_DIR / "temp_saves" / run_job_id / model_type / f"attempt_{attempt}"
            temp_model_dir = attempt_root / "model"
            backup_dir = attempt_root / "backup"
            try:
                if attempt_root.exists():
                    shutil.rmtree(attempt_root, ignore_errors=True)
                temp_model_dir.mkdir(parents=True, exist_ok=True)

                trainer.save_model(str(temp_model_dir))
                tokenizer.save_pretrained(str(temp_model_dir))

                if target_dir.exists():
                    target_dir.parent.mkdir(parents=True, exist_ok=True)
                    shutil.move(str(target_dir), str(backup_dir))

                shutil.move(str(temp_model_dir), str(target_dir))

                if backup_dir.exists():
                    shutil.rmtree(backup_dir, ignore_errors=True)
                time.sleep(0.25)
                logger.info(
                    f"[FINE-TUNE] Saved {model_type} model for {run_job_id} to {target_dir} on attempt {attempt}"
                )
                return

            except Exception as e:
                if not target_dir.exists() and backup_dir.exists():
                    try:
                        shutil.move(str(backup_dir), str(target_dir))
                    except Exception as restore_error:
                        logger.warning(
                            f"[FINE-TUNE] Restore backup failed for {model_type} {run_job_id}: {str(restore_error)}"
                        )

                logger.warning(
                    f"[FINE-TUNE] Save attempt {attempt}/{max_save_retries} failed for {model_type} {run_job_id}: {str(e)}"
                )
                if attempt == max_save_retries:
                    raise
                gc.collect()
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
                time.sleep(0.75 * attempt)

    @staticmethod
    def _extract_training_metrics(train_result, eval_result, epochs: int) -> Dict:
        """Extract normalized metrics from trainer outputs."""
        train_loss = getattr(train_result, "training_loss", None)
        if train_loss is None and hasattr(train_result, "metrics"):
            train_loss = train_result.metrics.get("train_loss")

        epochs_completed = eval_result.get("epoch")
        if epochs_completed is None and hasattr(train_result, "metrics"):
            epochs_completed = train_result.metrics.get("epoch")
        if epochs_completed is None:
            epochs_completed = epochs

        return {
            "accuracy": eval_result.get("eval_accuracy"),
            "f1_score": eval_result.get("eval_f1"),
            "eval_loss": eval_result.get("eval_loss"),
            "train_loss": train_loss,
            "epochs_completed": epochs_completed,
        }

    @staticmethod
    def _compute_classification_metrics(eval_pred) -> Dict[str, float]:
        """Compute accuracy and macro F1 from Trainer eval predictions."""
        import numpy as np

        logits = eval_pred.predictions
        labels = eval_pred.label_ids

        # HF can return tuple(predictions, ...)
        if isinstance(logits, tuple):
            logits = logits[0]

        preds = np.argmax(logits, axis=-1)
        labels = np.asarray(labels)
        preds = np.asarray(preds)

        if labels.size == 0:
            return {"accuracy": 0.0, "f1": 0.0}

        accuracy = float((preds == labels).mean())

        # Macro F1 without external dependency.
        all_classes = np.union1d(labels, preds)
        f1_scores = []
        for cls in all_classes:
            tp = np.sum((preds == cls) & (labels == cls))
            fp = np.sum((preds == cls) & (labels != cls))
            fn = np.sum((preds != cls) & (labels == cls))

            precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
            recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
            f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) > 0 else 0.0
            f1_scores.append(f1)

        macro_f1 = float(np.mean(f1_scores)) if len(f1_scores) > 0 else 0.0
        return {"accuracy": accuracy, "f1": macro_f1}
    
    @staticmethod
    async def fine_tune_sentiment(
        db,
        min_samples: int = 50,
        epochs: int = 3,
        batch_size: int = 8,
        learning_rate: float = 2e-5,
        optimizer: str = "AdamW",
        warmup_steps: int = 100,
        dropout: float = 0.1,
        job_id: Optional[str] = None,
        cancellation_event: Optional[threading.Event] = None,
    ) -> Dict:
        """
        Fine-tune the sentiment analysis model with collected feedback.
        
        Args:
            db: Database instance
            min_samples: Minimum samples required to start training
            epochs: Number of training epochs
            batch_size: Training batch size
            learning_rate: Learning rate for optimizer
            optimizer: Optimizer type (AdamW, Adam, SGD)
            warmup_steps: Number of warmup steps for learning rate scheduling
            dropout: Dropout rate for regularization
            
        Returns:
            Training results and metrics
        """
        from app.services.training_data_service import TrainingDataService
        
        # Fetch training data
        training_data = await TrainingDataService.get_sentiment_training_data(
            db, include_used=False, limit=5000
        )
        
        if len(training_data) < min_samples:
            return {
                "status": "skipped",
                "message": f"Insufficient data: {len(training_data)}/{min_samples} samples",
                "samples_available": len(training_data),
                "min_required": min_samples,
            }
        
        logger.info(f"[FINE-TUNE] Starting sentiment fine-tuning with {len(training_data)} samples")
        run_job_id = job_id or f"sentiment_{int(datetime.utcnow().timestamp())}"
        
        try:
            # Import ML dependencies
            import torch
            from transformers import (
                AutoTokenizer,
                AutoModelForSequenceClassification,
                Trainer,
                TrainerCallback,
                TrainingArguments,
            )
            from datasets import Dataset
            
            # Prepare dataset
            texts = [d["text"] for d in training_data]
            labels = [
                ModelFineTuningService.SENTIMENT_LABEL_MAP.get(str(d["label"]), 1)
                for d in training_data
            ]
            doc_ids = [d["id"] for d in training_data]

            if len(set(labels)) < 2:
                return {
                    "status": "skipped",
                    "message": "Sentiment training needs at least 2 sentiment classes before fine-tuning",
                    "samples_available": len(training_data),
                    "min_required": min_samples,
                }
            
            dataset = Dataset.from_dict({
                "text": texts,
                "label": labels,
            })
            
            # Load tokenizer and model
            model_name = "cardiffnlp/twitter-roberta-base-sentiment-latest"
            
            # Check if we have a fine-tuned version already
            if SENTIMENT_MODEL_PATH.exists():
                logger.info(f"[FINE-TUNE] Loading existing fine-tuned model from {SENTIMENT_MODEL_PATH}")
                model_path = str(SENTIMENT_MODEL_PATH)
            else:
                model_path = model_name

            # Release runtime inference handles before loading a new training model from disk.
            ModelFineTuningService._release_runtime_handles("sentiment")
            
            tokenizer = AutoTokenizer.from_pretrained(model_name)
            model = AutoModelForSequenceClassification.from_pretrained(
                model_path,
                num_labels=3,
                ignore_mismatched_sizes=True,
                low_cpu_mem_usage=True,
            )
            
            # Tokenize dataset
            def tokenize_function(examples):
                return tokenizer(
                    examples["text"],
                    padding="max_length",
                    truncation=True,
                    max_length=128,
                )
            
            tokenized_dataset = dataset.map(tokenize_function, batched=True)
            
            # Split into train/eval
            split = tokenized_dataset.train_test_split(test_size=0.1)
            train_dataset = split["train"]
            eval_dataset = split["test"]
            
            # Training arguments
            ModelFineTuningService._ensure_models_dir()
            train_output_dir = ModelFineTuningService._prepare_training_output_dir("sentiment", run_job_id)

            if cancellation_event and cancellation_event.is_set():
                raise asyncio.CancelledError()
            
            # Map optimizer string to actual optimizer
            optim_map = {
                "Adam": "adamw_torch",
                "AdamW": "adamw_torch",
                "SGD": "sgd",
            }
            optim_name = optim_map.get(optimizer, "adamw_torch")
            
            training_args = TrainingArguments(
                output_dir=str(train_output_dir),
                num_train_epochs=epochs,
                per_device_train_batch_size=batch_size,
                per_device_eval_batch_size=batch_size,
                learning_rate=learning_rate,
                weight_decay=0.01,
                warmup_steps=warmup_steps,
                optim=optim_name,
                eval_strategy="epoch",
                save_strategy="epoch",
                save_total_limit=2,
                load_best_model_at_end=True,
                save_safetensors=True,
                logging_dir=str(MODELS_DIR / "logs"),
                logging_steps=10,
                report_to="none",  # Disable wandb/tensorboard
            )

            sentiment_logs_queue = queue.Queue()

            class LiveTrainerLogCallback(TrainerCallback):
                def on_log(self, args, state, control, logs=None, **kwargs):
                    if not isinstance(logs, dict):
                        return

                    has_signal = any(
                        key in logs
                        for key in ["loss", "eval_loss", "eval_accuracy", "eval_f1", "learning_rate", "epoch"]
                    )
                    if not has_signal:
                        return

                    event = "eval" if any(key.startswith("eval_") for key in logs.keys()) else "train"
                    epoch = logs.get("epoch")
                    step = logs.get("step", state.global_step)
                    doc = {
                        "job_id": run_job_id,
                        "model_type": "sentiment",
                        "event": event,
                        "message": f"{event} epoch={epoch} step={step}",
                        "epoch": epoch,
                        "step": step,
                        "loss": logs.get("loss"),
                        "eval_loss": logs.get("eval_loss"),
                        "accuracy": logs.get("eval_accuracy"),
                        "f1_score": logs.get("eval_f1"),
                        "learning_rate": logs.get("learning_rate"),
                        "timestamp": datetime.utcnow(),
                    }
                    sentiment_logs_queue.put(doc)

            class StopRequestedCallback(TrainerCallback):
                def on_step_begin(self, args, state, control, **kwargs):
                    if cancellation_event and cancellation_event.is_set():
                        control.should_training_stop = True
                        control.should_save = False
                        control.should_evaluate = False
                        control.should_log = False
                    return control
            
            # Initialize trainer
            trainer = Trainer(
                model=model,
                args=training_args,
                train_dataset=train_dataset,
                eval_dataset=eval_dataset,
                compute_metrics=ModelFineTuningService._compute_classification_metrics,
                callbacks=[LiveTrainerLogCallback(), StopRequestedCallback()],
            )
            
            def _run_training_and_eval():
                start = datetime.utcnow()
                train_res = trainer.train()
                if cancellation_event and cancellation_event.is_set():
                    return train_res, None, start, datetime.utcnow()
                eval_res = trainer.evaluate()
                end = datetime.utcnow()
                return train_res, eval_res, start, end

            train_result, eval_result, start_time, end_time = await asyncio.to_thread(_run_training_and_eval)
            ModelFineTuningService._cleanup_training_output_dir(train_output_dir, "sentiment", run_job_id)
            
            # Flush queued logs to database
            queued_logs = []
            while not sentiment_logs_queue.empty():
                try:
                    queued_logs.append(sentiment_logs_queue.get_nowait())
                except queue.Empty:
                    break
            if queued_logs:
                try:
                    await db.tuning_job_logs.insert_many(queued_logs)
                except Exception as e:
                    logger.warning(f"[FINE-TUNE] Failed to flush sentiment logs: {str(e)}")

            if cancellation_event and cancellation_event.is_set():
                raise asyncio.CancelledError()
            
            extracted_metrics = ModelFineTuningService._extract_training_metrics(train_result, eval_result, epochs)
            accuracy = extracted_metrics["accuracy"]
            f1_score = extracted_metrics["f1_score"]
            eval_loss = extracted_metrics["eval_loss"]
            train_loss = extracted_metrics["train_loss"]
            epochs_completed = extracted_metrics["epochs_completed"]
            
            # Calculate model health (0-100)
            model_health = None
            if accuracy is not None and f1_score is not None:
                model_health = (accuracy * 100 + f1_score * 100) / 2
            
            # Save metrics to database for persistence
            try:
                metrics_doc = {
                    "model_type": "sentiment",
                    "accuracy": accuracy,
                    "f1_score": f1_score,
                    "loss": train_loss,
                    "eval_loss": eval_loss,
                    "model_health": model_health,
                    "job_id": run_job_id,
                    "created_at": datetime.utcnow(),
                    "epochs": epochs_completed,
                    "epochs_completed": epochs_completed,
                    "samples_used": len(training_data),
                }
                await db.tuning_model_metrics.insert_one(metrics_doc)
                
                # Get or create version number
                latest_version = await db.tuning_model_versions.find_one(
                    {"model_type": "sentiment"},
                    sort=[("version", -1)]
                )
                version_num = (latest_version.get("version", 0) if latest_version else 0) + 1
                
                # Save version record
                version_doc = {
                    "model_type": "sentiment",
                    "version": version_num,
                    "sample_count": len(training_data),
                    "accuracy": accuracy,
                    "f1_score": f1_score,
                    "loss": train_loss,
                    "eval_loss": eval_loss,
                    "created_at": datetime.utcnow(),
                    "checkpoint_path": str(SENTIMENT_MODEL_PATH),
                    "source_job_id": run_job_id,
                    "is_active": True,
                }
                
                # Mark previous version as inactive
                await db.tuning_model_versions.update_many(
                    {"model_type": "sentiment", "is_active": True, "version": {"$lt": version_num}},
                    {"$set": {"is_active": False}}
                )
                
                await db.tuning_model_versions.insert_one(version_doc)
                
            except Exception as e:
                logger.warning(f"[FINE-TUNE] Failed to save metrics/version: {str(e)}")

            artifact_saved = True
            warning_message = None
            try:
                await asyncio.to_thread(
                    ModelFineTuningService._save_model_to_temp_then_replace,
                    trainer,
                    tokenizer,
                    SENTIMENT_MODEL_PATH,
                    "sentiment",
                    run_job_id,
                )
                await ModelFineTuningService._reload_runtime_model("sentiment", run_job_id)
            except Exception as save_error:
                artifact_saved = False
                warning_message = (
                    "Training succeeded and metrics were saved, but model file save failed. "
                    "Restart backend or retry fine-tuning on Windows."
                )
                logger.error(f"[FINE-TUNE] Sentiment model artifact save failed for {run_job_id}: {str(save_error)}")

            # Mark source data as used only after successful training completion.
            await TrainingDataService.mark_sentiment_data_used(db, doc_ids)
            remaining_samples = await db.sentiment_training.count_documents({"used_for_training": False})
            
            logger.info(f"[FINE-TUNE] Sentiment training complete. Loss: {float(train_loss or 0.0):.4f}, Accuracy: {accuracy}")
            
            return {
                "status": "success",
                "job_id": run_job_id,
                "model": "sentiment",
                "samples_used": len(training_data),
                "epochs": epochs,
                "epochs_completed": epochs_completed,
                "training_loss": train_loss,
                "eval_loss": eval_loss,
                "accuracy": accuracy,
                "f1_score": f1_score,
                "samples_remaining": remaining_samples,
                "duration_seconds": (end_time - start_time).total_seconds(),
                "model_saved_to": str(SENTIMENT_MODEL_PATH),
                "artifact_saved": artifact_saved,
                "warning_message": warning_message,
                "message": warning_message if warning_message else "sentiment fine-tuning completed",
            }
            
        except Exception as e:
            logger.error(f"[FINE-TUNE] Sentiment training failed: {str(e)}")
            return {
                "status": "error",
                "message": str(e),
                "samples_available": len(training_data),
            }
    
    @staticmethod
    async def fine_tune_credibility(
        db,
        min_samples: int = 30,
        epochs: int = 3,
        batch_size: int = 8,
        learning_rate: float = 2e-5,
        optimizer: str = "AdamW",
        warmup_steps: int = 100,
        dropout: float = 0.1,
        job_id: Optional[str] = None,
        cancellation_event: Optional[threading.Event] = None,
    ) -> Dict:
        """
        Fine-tune the credibility/fake-news detection model.
        Only uses verified or multi-reported samples for quality.
        
        Args:
            db: Database instance
            min_samples: Minimum samples required to start training
            epochs: Number of training epochs
            batch_size: Training batch size
            learning_rate: Learning rate for optimizer
            optimizer: Optimizer type (AdamW, Adam, SGD)
            warmup_steps: Number of warmup steps for learning rate scheduling
            dropout: Dropout rate for regularization
            
        Returns:
            Training results and metrics
        """
        from app.services.training_data_service import TrainingDataService
        
        # Fetch training data (only verified/multi-reported)
        training_data = await TrainingDataService.get_credibility_training_data(
            db,
            status_filter=["verified", "multi_reported"],
            include_used=False,
            limit=5000,
        )
        
        if len(training_data) < min_samples:
            return {
                "status": "skipped",
                "message": f"Insufficient verified data: {len(training_data)}/{min_samples} samples",
                "samples_available": len(training_data),
                "min_required": min_samples,
            }
        
        logger.info(f"[FINE-TUNE] Starting credibility fine-tuning with {len(training_data)} samples")
        run_job_id = job_id or f"credibility_{int(datetime.utcnow().timestamp())}"
        
        try:
            import torch
            from transformers import (
                AutoTokenizer,
                AutoModelForSequenceClassification,
                Trainer,
                TrainerCallback,
                TrainingArguments,
            )
            from datasets import Dataset
            
            texts = [d["text"] for d in training_data]
            labels = [
                ModelFineTuningService.CREDIBILITY_LABEL_MAP.get(str(d["label"]), 1)
                for d in training_data
            ]
            doc_ids = [d["id"] for d in training_data]

            if len(set(labels)) < 2:
                return {
                    "status": "skipped",
                    "message": "Credibility training needs both REAL and FAKE examples before fine-tuning",
                    "samples_available": len(training_data),
                    "min_required": min_samples,
                }
            
            dataset = Dataset.from_dict({
                "text": texts,
                "label": labels,
            })
            
            # Load model
            model_name = "mrm8488/bert-tiny-finetuned-fake-news-detection"
            
            if CREDIBILITY_MODEL_PATH.exists():
                logger.info(f"[FINE-TUNE] Loading existing fine-tuned model from {CREDIBILITY_MODEL_PATH}")
                model_path = str(CREDIBILITY_MODEL_PATH)
            else:
                model_path = model_name

            # Release runtime inference handles before loading a new training model from disk.
            ModelFineTuningService._release_runtime_handles("credibility")
            
            tokenizer = AutoTokenizer.from_pretrained(model_name)
            model = AutoModelForSequenceClassification.from_pretrained(
                model_path,
                num_labels=2,
                low_cpu_mem_usage=True,
            )
            
            # Tokenize
            def tokenize_function(examples):
                return tokenizer(
                    examples["text"],
                    padding="max_length",
                    truncation=True,
                    max_length=256,
                )
            
            tokenized_dataset = dataset.map(tokenize_function, batched=True)
            
            # Split
            split = tokenized_dataset.train_test_split(test_size=0.1)
            train_dataset = split["train"]
            eval_dataset = split["test"]
            
            # Training args
            ModelFineTuningService._ensure_models_dir()
            train_output_dir = ModelFineTuningService._prepare_training_output_dir("credibility", run_job_id)

            if cancellation_event and cancellation_event.is_set():
                raise asyncio.CancelledError()
            
            # Map optimizer string to actual optimizer
            optim_map = {
                "Adam": "adamw_torch",
                "AdamW": "adamw_torch",
                "SGD": "sgd",
            }
            optim_name = optim_map.get(optimizer, "adamw_torch")
            
            training_args = TrainingArguments(
                output_dir=str(train_output_dir),
                num_train_epochs=epochs,
                per_device_train_batch_size=batch_size,
                per_device_eval_batch_size=batch_size,
                learning_rate=learning_rate,
                weight_decay=0.01,
                warmup_steps=warmup_steps,
                optim=optim_name,
                eval_strategy="epoch",
                save_strategy="epoch",
                save_total_limit=2,
                load_best_model_at_end=True,
                save_safetensors=True,
                logging_dir=str(MODELS_DIR / "logs"),
                logging_steps=10,
                report_to="none",
            )

            credibility_logs_queue = queue.Queue()

            class LiveTrainerLogCallback(TrainerCallback):
                def on_log(self, args, state, control, logs=None, **kwargs):
                    if not isinstance(logs, dict):
                        return

                    has_signal = any(
                        key in logs
                        for key in ["loss", "eval_loss", "eval_accuracy", "eval_f1", "learning_rate", "epoch"]
                    )
                    if not has_signal:
                        return

                    event = "eval" if any(key.startswith("eval_") for key in logs.keys()) else "train"
                    epoch = logs.get("epoch")
                    step = logs.get("step", state.global_step)
                    doc = {
                        "job_id": run_job_id,
                        "model_type": "credibility",
                        "event": event,
                        "message": f"{event} epoch={epoch} step={step}",
                        "epoch": epoch,
                        "step": step,
                        "loss": logs.get("loss"),
                        "eval_loss": logs.get("eval_loss"),
                        "accuracy": logs.get("eval_accuracy"),
                        "f1_score": logs.get("eval_f1"),
                        "learning_rate": logs.get("learning_rate"),
                        "timestamp": datetime.utcnow(),
                    }
                    credibility_logs_queue.put(doc)

            class StopRequestedCallback(TrainerCallback):
                def on_step_begin(self, args, state, control, **kwargs):
                    if cancellation_event and cancellation_event.is_set():
                        control.should_training_stop = True
                        control.should_save = False
                        control.should_evaluate = False
                        control.should_log = False
                    return control
            
            trainer = Trainer(
                model=model,
                args=training_args,
                train_dataset=train_dataset,
                eval_dataset=eval_dataset,
                compute_metrics=ModelFineTuningService._compute_classification_metrics,
                callbacks=[LiveTrainerLogCallback(), StopRequestedCallback()],
            )
            
            def _run_training_and_eval():
                start = datetime.utcnow()
                train_res = trainer.train()
                if cancellation_event and cancellation_event.is_set():
                    return train_res, None, start, datetime.utcnow()
                eval_res = trainer.evaluate()
                end = datetime.utcnow()
                return train_res, eval_res, start, end

            train_result, eval_result, start_time, end_time = await asyncio.to_thread(_run_training_and_eval)
            ModelFineTuningService._cleanup_training_output_dir(train_output_dir, "credibility", run_job_id)
            
            # Flush queued logs to database
            queued_logs = []
            while not credibility_logs_queue.empty():
                try:
                    queued_logs.append(credibility_logs_queue.get_nowait())
                except queue.Empty:
                    break
            if queued_logs:
                try:
                    await db.tuning_job_logs.insert_many(queued_logs)
                except Exception as e:
                    logger.warning(f"[FINE-TUNE] Failed to flush credibility logs: {str(e)}")

            if cancellation_event and cancellation_event.is_set():
                raise asyncio.CancelledError()
            
            extracted_metrics = ModelFineTuningService._extract_training_metrics(train_result, eval_result, epochs)
            accuracy = extracted_metrics["accuracy"]
            f1_score = extracted_metrics["f1_score"]
            eval_loss = extracted_metrics["eval_loss"]
            train_loss = extracted_metrics["train_loss"]
            epochs_completed = extracted_metrics["epochs_completed"]
            
            # Calculate model health (0-100)
            model_health = None
            if accuracy is not None and f1_score is not None:
                model_health = (accuracy * 100 + f1_score * 100) / 2
            
            # Save metrics to database for persistence
            try:
                metrics_doc = {
                    "model_type": "credibility",
                    "accuracy": accuracy,
                    "f1_score": f1_score,
                    "loss": train_loss,
                    "eval_loss": eval_loss,
                    "model_health": model_health,
                    "job_id": run_job_id,
                    "created_at": datetime.utcnow(),
                    "epochs": epochs_completed,
                    "epochs_completed": epochs_completed,
                    "samples_used": len(training_data),
                }
                await db.tuning_model_metrics.insert_one(metrics_doc)
                
                # Get or create version number
                latest_version = await db.tuning_model_versions.find_one(
                    {"model_type": "credibility"},
                    sort=[("version", -1)]
                )
                version_num = (latest_version.get("version", 0) if latest_version else 0) + 1
                
                # Save version record
                version_doc = {
                    "model_type": "credibility",
                    "version": version_num,
                    "sample_count": len(training_data),
                    "accuracy": accuracy,
                    "f1_score": f1_score,
                    "loss": train_loss,
                    "eval_loss": eval_loss,
                    "created_at": datetime.utcnow(),
                    "checkpoint_path": str(CREDIBILITY_MODEL_PATH),
                    "source_job_id": run_job_id,
                    "is_active": True,
                }
                
                # Mark previous version as inactive
                await db.tuning_model_versions.update_many(
                    {"model_type": "credibility", "is_active": True, "version": {"$lt": version_num}},
                    {"$set": {"is_active": False}}
                )
                
                await db.tuning_model_versions.insert_one(version_doc)
                
            except Exception as e:
                logger.warning(f"[FINE-TUNE] Failed to save metrics/version: {str(e)}")

            artifact_saved = True
            warning_message = None
            try:
                await asyncio.to_thread(
                    ModelFineTuningService._save_model_to_temp_then_replace,
                    trainer,
                    tokenizer,
                    CREDIBILITY_MODEL_PATH,
                    "credibility",
                    run_job_id,
                )
                await ModelFineTuningService._reload_runtime_model("credibility", run_job_id)
            except Exception as save_error:
                artifact_saved = False
                warning_message = (
                    "Training succeeded and metrics were saved, but model file save failed. "
                    "Restart backend or retry fine-tuning on Windows."
                )
                logger.error(f"[FINE-TUNE] Credibility model artifact save failed for {run_job_id}: {str(save_error)}")

            # Mark source data as used only after successful training completion.
            await TrainingDataService.mark_credibility_data_used(db, doc_ids)
            remaining_samples = await db.credibility_training.count_documents(
                {
                    "verification_status": {"$in": ["verified", "multi_reported"]},
                    "used_for_training": False,
                }
            )
            
            logger.info(f"[FINE-TUNE] Credibility training complete. Loss: {float(train_loss or 0.0):.4f}, Accuracy: {accuracy}")
            
            return {
                "status": "success",
                "job_id": run_job_id,
                "model": "credibility",
                "samples_used": len(training_data),
                "epochs": epochs,
                "epochs_completed": epochs_completed,
                "training_loss": train_loss,
                "eval_loss": eval_loss,
                "accuracy": accuracy,
                "f1_score": f1_score,
                "samples_remaining": remaining_samples,
                "duration_seconds": (end_time - start_time).total_seconds(),
                "model_saved_to": str(CREDIBILITY_MODEL_PATH),
                "artifact_saved": artifact_saved,
                "warning_message": warning_message,
                "message": warning_message if warning_message else "credibility fine-tuning completed",
            }
            
        except Exception as e:
            logger.error(f"[FINE-TUNE] Credibility training failed: {str(e)}")
            return {
                "status": "error",
                "message": str(e),
                "samples_available": len(training_data),
            }
    
    @staticmethod
    async def fine_tune_all(db) -> Dict:
        """
        Run fine-tuning for all models.
        
        Args:
            db: Database instance
            
        Returns:
            Combined results for all models
        """
        sentiment_result = await ModelFineTuningService.fine_tune_sentiment(db)
        credibility_result = await ModelFineTuningService.fine_tune_credibility(db)
        
        return {
            "sentiment": sentiment_result,
            "credibility": credibility_result,
            "timestamp": datetime.utcnow().isoformat(),
        }
    
    @staticmethod
    def get_model_info() -> Dict:
        """
        Get information about current model versions.
        """
        sentiment_finetuned = SENTIMENT_MODEL_PATH.exists()
        credibility_finetuned = CREDIBILITY_MODEL_PATH.exists()
        
        info = {
            "sentiment": {
                "base_model": "cardiffnlp/twitter-roberta-base-sentiment-latest",
                "fine_tuned": sentiment_finetuned,
                "fine_tuned_path": str(SENTIMENT_MODEL_PATH) if sentiment_finetuned else None,
            },
            "credibility": {
                "base_model": "mrm8488/bert-tiny-finetuned-fake-news-detection",
                "fine_tuned": credibility_finetuned,
                "fine_tuned_path": str(CREDIBILITY_MODEL_PATH) if credibility_finetuned else None,
            },
        }
        
        # Get file sizes if available
        if sentiment_finetuned:
            try:
                size = sum(f.stat().st_size for f in SENTIMENT_MODEL_PATH.rglob("*") if f.is_file())
                info["sentiment"]["size_mb"] = round(size / (1024 * 1024), 2)
            except:
                pass
        
        if credibility_finetuned:
            try:
                size = sum(f.stat().st_size for f in CREDIBILITY_MODEL_PATH.rglob("*") if f.is_file())
                info["credibility"]["size_mb"] = round(size / (1024 * 1024), 2)
            except:
                pass
        
        return info
