---
name: 'Validation and Typing'
description: 'Requires the use of pydantic for typings, and mypy and ruff for validation and linting.'
category: 'python-development'
version: '1.0.0'
---

# Validation and Typing

## Overview

This project enforces strong typing and code quality. You must use `pydantic` for defining typings and data structures, `mypy` for static type validation, and `ruff` for code linting and formatting.

## Requirements

- `pydantic`
- `mypy`
- `ruff`

## Usage Guidelines

- **Typings**: ALWAYS use `pydantic` models for structured data, configurations, and API payloads instead of plain dictionaries or dataclasses.
- **Type Checking**: Run `mypy` against the codebase to ensure all type hints are correct and that there are no type discrepancies.
- **Linting & Formatting**: Run `ruff` to identify and fix code style violations and ensure standard Python formatting.

## Examples

### Correct Usage

```python
from pydantic import BaseModel

class UserProfile(BaseModel):
    id: int
    name: str
    is_active: bool = True
```
