import os
import sys
from loguru import logger

def setup_logging():
    # Remove default handler
    logger.remove()
    
    # Determine log level
    is_quiet = os.getenv("QUIET", "false").lower() == "true"
    level = "WARNING" if is_quiet else os.getenv("LOG_LEVEL", "INFO").upper()
    
    # Add new handler to stderr
    logger.add(sys.stderr, level=level, format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>")

# Initialize logging
setup_logging()
