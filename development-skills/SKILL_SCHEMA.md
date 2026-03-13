# Skill Schema

All skills within the `development-skills/` and `mcp-skills/` directories must adhere to the following frontmatter and structural requirements.

## Frontmatter Requirements

Each `SKILL.md` file must include YAML frontmatter at the top of the file, enclosed by `---`.

```yaml
---
name: string # The human-readable name of the skill
description: string # A brief description of what this skill provides
category: string # The category this skill belongs to (e.g., nodejs-development, python-development)
version: string # The version of the skill schema or content (e.g., 1.0.0)
---
```

## Structure

Following the frontmatter, the file should contain:

1. **Overview**: A brief explanation of the skill.
2. **Requirements**: Any required libraries or setup.
3. **Usage Guidelines**: How to apply the skill.
4. **Examples**: Concrete examples demonstrating the skill in action.
