---
name: 'Testing with Jest and Nock'
description: 'Instructions and examples for writing Jest tests and mocking external requests with Nock.'
category: 'nodejs-development'
version: '1.0.0'
---

# Testing with Jest and Nock

## Overview

This skill provides guidelines for writing and running automated tests using Jest, and mocking external HTTP requests using Nock.

## Requirements

- `jest` (installed as a dev dependency)
- `nock` (installed as a dev dependency)

## Usage Guidelines

- Always write tests for new features and bug fixes.
- Use `describe` to group related tests and `it` or `test` for individual test cases.
- Use `nock` to intercept and mock any HTTP requests to external APIs so tests run quickly and reliably without external dependencies.
- Ensure test files are named `*.test.js` or `*.spec.js`.

## Examples

### Basic Jest Test

```javascript
import { sum } from '../src/math.js';

describe('Math utilities', () => {
  it('adds 1 + 2 to equal 3', () => {
    expect(sum(1, 2)).toBe(3);
  });
});
```

### Mocking with Nock

```javascript
import nock from 'nock';
import { fetchUserData } from '../src/api.js';

describe('API utilities', () => {
  it('fetches user data correctly', async () => {
    nock('https://api.example.com').get('/users/1').reply(200, { id: 1, name: 'Alice' });

    const data = await fetchUserData(1);
    expect(data.name).toBe('Alice');
  });
});
```
