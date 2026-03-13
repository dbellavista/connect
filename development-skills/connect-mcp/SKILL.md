---
name: Connect MCP Guidelines
description: Guidelines and best practices for interacting with the connect MCP server.
category: mcp
version: 1.0.0
---

## Overview

This skill provides guidelines for agents interacting with the `connect` MCP server to ensure proper execution of tools.

## Requirements

The `connect-mcp` MCP server must be running or available to the agent.

## Usage Guidelines

When interacting with the `connect` MCP server, agents should:

1. Fetch the exact tool workflow documentation by reading the `skill://remarkable` or `skill://ytmusic` resource.
2. Use `ytmusic_list_playlists` or `remarkable_ls_json` to gather IDs, hashes, and directory paths before running mutating commands.
3. The MCP server operates non-interactively via stdio. For granular YT Music workflows, fetch the candidates first, inspect the JSON, and then issue the execution commands passing the targeted JSON array.

## Examples

**Gathering IDs before a mutating command:**
Use `remarkable_ls_json` to fetch metadata for a directory to extract the hash, and then call `remarkable_delete` passing that exact hash.
