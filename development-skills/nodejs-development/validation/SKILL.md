---
name: 'Validation with class-validator and class-transformer'
description: 'Guidelines for applying class-validator decorators and transforming objects with class-transformer.'
category: 'nodejs-development'
version: '1.0.0'
---

# Validation with class-validator and class-transformer

## Overview

This skill enforces robust data validation and transformation rules using `class-validator` and `class-transformer`.

## Requirements

- `class-validator`
- `class-transformer`
- Note: This project does not necessarily use TypeScript, but the decorators can still be applied if the transpilation allows it, or standard JS validation patterns based on these libraries.

## Usage Guidelines

- Define models/classes for all incoming data payloads.
- Use decorators like `@IsString()`, `@IsInt()`, `@IsOptional()` to describe the validation rules.
- Use `plainToInstance` from `class-transformer` to convert plain JavaScript objects (e.g., from `JSON.parse`) into instances of the defined classes.
- Use `validate` from `class-validator` to ensure the instances meet the requirements before proceeding with business logic.

## Examples

### Defining and Validating a Class

```javascript
import { IsString, IsInt, validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

class UserInput {
  @IsString()
  name;

  @IsInt()
  age;
}

async function handleInput(payload) {
  const userInput = plainToInstance(UserInput, payload);
  const errors = await validate(userInput);

  if (errors.length > 0) {
    throw new Error(`Validation failed: ${errors}`);
  }

  // Proceed with validated data
}
```

_Note: Since this is a vanilla JS (ESM) project without Babel/TS, decorators might require specific compilation setup. If not available, use the programmatic validation approach or standard schema validation._
