---
name: 'Logging with Loguru'
description: 'Requires the use of loguru for all logging, explicitly forbidding print() and string formatting.'
category: 'python-development'
version: '1.0.0'
---

# Logging with Loguru

## Overview

This project uses `loguru` for high-performance, structured logging. The use of standard `print()` is explicitly forbidden except for temporary local debugging. String formatting in log messages (e.g., using f-strings or `.format()`) must be avoided. Instead, always use `.bind()` to attach extra variables to the log context.

## Requirements

- `loguru`
- Import `logger` from `loguru`.

## Usage Guidelines

- ALWAYS import the logger instance from `loguru`.
- NEVER use `print()`.
- AVOID string formatting in log messages.
- REQUIRE using `.bind()` to add context variables instead of embedding them in the message string.
- Use the appropriate log level (`logger.debug()`, `logger.info()`, `logger.warning()`, `logger.error()`, `logger.exception()`).

## Examples

### Correct Usage

```python
from loguru import logger

def process_user(user_id: int):
    # Correct: Use bind() for extra variables
    log = logger.bind(user_id=user_id)
    log.info("Processing user data")
    
    try:
        # ... process logic ...
        log.debug("User data processed successfully")
    except Exception as e:
        log.bind(error=str(e)).error("Failed to process user data")
```

### Incorrect Usage (DO NOT DO THIS)

```python
# Incorrect: Using print
print(f"Processing user {user_id}")

# Incorrect: Using string formatting in the log message
logger.info(f"Processing user {user_id}")
```
