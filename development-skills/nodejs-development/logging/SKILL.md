---
name: 'Logging with Pino'
description: 'Strict instructions requiring the use of the pino logger for all serializable logs and explicitly forbidding the use of console.log.'
category: 'nodejs-development'
version: '1.0.0'
---

# Logging with Pino

## Overview

This project uses `pino` for high-performance, structured logging. The use of global `console` methods (like `console.log`, `console.info`, `console.warn`) is explicitly forbidden.

## Requirements

- `pino`
- The project logger utility exported from `src/utils/logger.js`.
- ESLint rule `"no-console": "error"` is active to prevent accidental usage of `console`.

## Usage Guidelines

- ALWAYS import the logger instance from `src/utils/logger.js` (or similar utility).
- NEVER use `console.log()`, `console.info()`, `console.warn()`, or `console.error()`.
- Use the appropriate log level:
  - `logger.debug()` for detailed debug information.
  - `logger.info()` for general informational messages.
  - `logger.warn()` for warnings.
  - `logger.error()` for error objects and messages.
- Always log structured data when possible (e.g., `logger.info({ userId: 123 }, 'User logged in')`).

## Examples

### Correct Usage

```javascript
import { logger } from '../utils/logger.js';

function processUser(user) {
  logger.info({ userId: user.id }, 'Processing user data');
  try {
    // ...
    logger.debug('User data processed successfully');
  } catch (err) {
    logger.error({ err, userId: user.id }, 'Failed to process user data');
  }
}
```

### Incorrect Usage (DO NOT DO THIS)

```javascript
// FORBIDDEN: Do not use console.log
console.log('Processing user data', user.id);
```
