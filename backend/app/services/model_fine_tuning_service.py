"""
Model Fine-Tuning Service

Handles fine-tuning of ML models using collected training data.
Supports both sentiment (RoBERTa) and credibility (BERT-tiny) models.
"""

import logging
import os
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
    async def fine_tune_sentiment(
        db,
        min_samples: int = 50,
        epochs: int = 3,
        batch_size: int = 8,
        learning_rate: float = 2e-5,
    ) -> Dict:
        """
        Fine-tune the sentiment analysis model with collected feedback.
        
        Args:
            db: Database instance
            min_samples: Minimum samples required to start training
            epochs: Number of training epochs
            batch_size: Training batch size
            learning_rate: Learning rate for optimizer
            
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
        
        try:
            # Import ML dependencies
            import torch
            from transformers import (
                AutoTokenizer,
                AutoModelForSequenceClassification,
                Trainer,
                TrainingArguments,
            )
            from datasets import Dataset
            
            # Prepare dataset
            texts = [d["text"] for d in training_data]
            labels = [
                ModelFineTuningService.SENTIMENT_LABEL_MAP.get(d["label"], 1)
                for d in training_data
            ]
            doc_ids = [d["id"] for d in training_data]
            
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
            
            tokenizer = AutoTokenizer.from_pretrained(model_name)
            model = AutoModelForSequenceClassification.from_pretrained(
                model_path,
                num_labels=3,
                ignore_mismatched_sizes=True,
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
            
            training_args = TrainingArguments(
                output_dir=str(SENTIMENT_MODEL_PATH),
                num_train_epochs=epochs,
                per_device_train_batch_size=batch_size,
                per_device_eval_batch_size=batch_size,
                learning_rate=learning_rate,
                weight_decay=0.01,
                evaluation_strategy="epoch",
                save_strategy="epoch",
                load_best_model_at_end=True,
                logging_dir=str(MODELS_DIR / "logs"),
                logging_steps=10,
                report_to="none",  # Disable wandb/tensorboard
            )
            
            # Initialize trainer
            trainer = Trainer(
                model=model,
                args=training_args,
                train_dataset=train_dataset,
                eval_dataset=eval_dataset,
            )
            
            # Train
            start_time = datetime.utcnow()
            train_result = trainer.train()
            end_time = datetime.utcnow()
            
            # Save model
            trainer.save_model(str(SENTIMENT_MODEL_PATH))
            tokenizer.save_pretrained(str(SENTIMENT_MODEL_PATH))
            
            # Mark data as used
            await TrainingDataService.mark_sentiment_data_used(db, doc_ids)
            
            # Evaluate
            eval_result = trainer.evaluate()
            
            logger.info(f"[FINE-TUNE] Sentiment training complete. Loss: {train_result.training_loss:.4f}")
            
            return {
                "status": "success",
                "model": "sentiment",
                "samples_used": len(training_data),
                "epochs": epochs,
                "training_loss": train_result.training_loss,
                "eval_loss": eval_result.get("eval_loss"),
                "duration_seconds": (end_time - start_time).total_seconds(),
                "model_saved_to": str(SENTIMENT_MODEL_PATH),
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
        
        try:
            import torch
            from transformers import (
                AutoTokenizer,
                AutoModelForSequenceClassification,
                Trainer,
                TrainingArguments,
            )
            from datasets import Dataset
            
            # All collected data is labeled as FAKE (user reports of misleading content)
            # We need to balance with REAL samples from trusted sources
            # For now, we'll use all as FAKE and rely on the base model's REAL training
            texts = [d["text"] for d in training_data]
            labels = [1 for _ in training_data]  # All FAKE
            doc_ids = [d["id"] for d in training_data]
            
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
            
            tokenizer = AutoTokenizer.from_pretrained(model_name)
            model = AutoModelForSequenceClassification.from_pretrained(
                model_path,
                num_labels=2,
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
            
            training_args = TrainingArguments(
                output_dir=str(CREDIBILITY_MODEL_PATH),
                num_train_epochs=epochs,
                per_device_train_batch_size=batch_size,
                per_device_eval_batch_size=batch_size,
                learning_rate=learning_rate,
                weight_decay=0.01,
                evaluation_strategy="epoch",
                save_strategy="epoch",
                load_best_model_at_end=True,
                logging_dir=str(MODELS_DIR / "logs"),
                logging_steps=10,
                report_to="none",
            )
            
            trainer = Trainer(
                model=model,
                args=training_args,
                train_dataset=train_dataset,
                eval_dataset=eval_dataset,
            )
            
            start_time = datetime.utcnow()
            train_result = trainer.train()
            end_time = datetime.utcnow()
            
            # Save
            trainer.save_model(str(CREDIBILITY_MODEL_PATH))
            tokenizer.save_pretrained(str(CREDIBILITY_MODEL_PATH))
            
            # Mark used
            await TrainingDataService.mark_credibility_data_used(db, doc_ids)
            
            # Evaluate
            eval_result = trainer.evaluate()
            
            logger.info(f"[FINE-TUNE] Credibility training complete. Loss: {train_result.training_loss:.4f}")
            
            return {
                "status": "success",
                "model": "credibility",
                "samples_used": len(training_data),
                "epochs": epochs,
                "training_loss": train_result.training_loss,
                "eval_loss": eval_result.get("eval_loss"),
                "duration_seconds": (end_time - start_time).total_seconds(),
                "model_saved_to": str(CREDIBILITY_MODEL_PATH),
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
