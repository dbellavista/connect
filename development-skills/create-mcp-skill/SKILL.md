---
name: Create MCP Skill
description: Guidelines on how to create a new skill to be served via the MCP server.
category: mcp-development
version: 1.0.0
---

## Overview

This skill provides guidelines on how to create a new "skill" that will be served via the `connect` Model Context Protocol (MCP) server.

## Requirements

You must be familiar with the `src/mcp-server.js` architecture.

## Usage Guidelines

To add a new skill to the MCP server:

1. **Create the Skill Directory:**
   Create a new directory inside `mcp-skills/` corresponding to the platform or domain (e.g., `mcp-skills/new-platform/`).

2. **Add Documentation:**
   If the agent needs to dynamically read the skill's guidelines via MCP, add a `README.md` inside the new directory explaining the workflows and available tools. 
   
   *Example:* `mcp-skills/new-platform/README.md`

3. **Expose the Resource (Optional):**
   If you created a `README.md` in Step 2, expose it as a resource in `src/mcp-server.js` under the `ReadResourceRequestSchema` handler.
   
   ```javascript
   if (uri === 'skill://new-platform') {
     filePath = path.join(process.cwd(), 'mcp-skills/new-platform/README.md');
   }
   ```

4. **Add Tools to the MCP Server:**
   Implement the actual commands/functions in `src/mcp-server.js`.
   - Add tool definitions in the `ListToolsRequestSchema` handler.
   - Add tool execution logic in the `CallToolRequestSchema` handler.

5. **Update AGENTS.md:**
   Document the new skill and its tools in `AGENTS.md` under the "Skills Directory and Resources" section so that AI agents are aware of its existence.

## Examples

**Adding a simple read tool:**
1. Define `{ name: 'new_platform_read', description: '...', parameters: { ... } }` in `ListToolsRequestSchema`.
2. Handle `case 'new_platform_read':` in `CallToolRequestSchema`.
3. Update `AGENTS.md` to list `- new_platform_read: description here`.
