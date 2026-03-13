---
name: 'Formatting with Prettier and ESLint'
description: 'Workflows for enforcing code style via ESLint and Prettier before committing changes.'
category: 'nodejs-development'
version: '1.0.0'
---

# Formatting with Prettier and ESLint

## Overview

This skill provides instructions on how to maintain consistent code styling and catch syntax/logic errors using Prettier and ESLint.

## Requirements

- `prettier`
- `eslint`
- An existing `.prettierrc` configuration file
- An existing `eslint.config.js` configuration file

## Usage Guidelines

- Ensure that all code changes follow the project's Prettier and ESLint rules.
- Run `npm run lint` to check for style issues and errors.
- Run `npm run format` to auto-format files.
- You must fix any linting errors before finalizing changes.

## Examples

### Formatting Files

Run the format command to auto-correct stylistic issues:

```bash
npm run format
```

### Checking for Lint Errors

Run the lint command to verify code quality:

```bash
npm run lint
```
