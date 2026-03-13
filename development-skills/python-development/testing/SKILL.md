---
name: 'Testing with Pytest'
description: 'Requires the use of pytest for all automatic testing.'
category: 'python-development'
version: '1.0.0'
---

# Testing with Pytest

## Overview

This project uses `pytest` as its primary testing framework. All new features, bug fixes, and changes must include comprehensive automated tests written for `pytest` and placed in the `tests/` directory.

## Requirements

- `pytest`
- Tests must be placed in the `tests/` directory.
- Test files must follow the naming convention `test_*.py` or `*_test.py`.

## Usage Guidelines

- ALWAYS write tests using `pytest` idioms (e.g., plain `assert` statements rather than `unittest` assertion methods).
- Group tests logically using functions or classes.
- Ensure all Edge Cases and Happy Paths are covered.

## Examples

### Correct Usage

```python
import pytest

def test_example_function():
    result = True
    assert result is True, "The result should be True"
```
