"""Application-wide logging configuration."""

import logging
import os
from logging.handlers import RotatingFileHandler


def configure_logging() -> None:
    """Configure structured logging for the FastAPI app.

    - Sends logs to stdout (picked up by uvicorn) and to a rotating file.
    - Respects LOG_LEVEL env var; defaults to INFO.
    """

    root_logger = logging.getLogger()
    
    # Check if logging is already configured to prevent duplicate handlers
    if root_logger.handlers:
        return

    log_level = os.getenv("LOG_LEVEL", "INFO").upper()

    # Basic formatter shared by handlers
    formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    root_logger.setLevel(log_level)

    # Stream handler (stdout) with UTF-8 encoding for Windows compatibility
    stream_handler = logging.StreamHandler()
    stream_handler.setFormatter(formatter)
    # Force UTF-8 encoding to handle Unicode characters on Windows
    if hasattr(stream_handler.stream, 'reconfigure'):
        try:
            stream_handler.stream.reconfigure(encoding='utf-8')
        except Exception:
            pass  # Fallback gracefully if reconfigure fails
    root_logger.addHandler(stream_handler)

    # Rotating file handler (optional, skip if path not provided)
    log_file = os.getenv("LOG_FILE", "logs/app.log")
    try:
        os.makedirs(os.path.dirname(log_file), exist_ok=True)
        file_handler = RotatingFileHandler(log_file, maxBytes=1_000_000, backupCount=3)
        file_handler.setFormatter(formatter)
        root_logger.addHandler(file_handler)
    except OSError:
        # Fail silently if file handler cannot be created; stdout still works.
        pass

    # Reduce noise from overly chatty libraries
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("asyncio").setLevel(logging.WARNING)

    root_logger.info("Logging configured", extra={"level": log_level})

