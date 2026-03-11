# Connect Agents & Skills

This document describes the various agent skills available in this project and where to find them. The functionalities of `connect` are exposed both via CLI tools and through a unified Model Context Protocol (MCP) server (`mcp-server.js`).

## What is an MCP Server?
The included MCP Server allows AI agents to interface directly with the functionalities implemented in this project. The server exposes a set of non-interactive tools to manage reMarkable and YouTube Music. 

**To run the MCP server locally:**
```bash
node mcp-server.js
```

**To run the MCP server using Docker:**
1. Build the image:
   ```bash
   docker build -t connect-mcp .
   ```
2. Run the container (you must mount your `data/` directory for the authentication and cache to persist):
   ```bash
   docker run -i \
     -v $(pwd)/data:/app/data \
     connect-mcp
   ```

## Skills Directory and Resources
Skills are organized by platform in the `skills/` directory.

The MCP server exposes the documentation for these skills directly as resources that an AI agent can read dynamically:
- `skill://remarkable`: Returns the markdown contents of `skills/remarkable/README.md`.
- `skill://ytmusic`: Returns the markdown contents of `skills/ytmusic/README.md`.

Alternatively, you can read the files directly here:
- [reMarkable Skills](skills/remarkable/README.md)
  - `remarkable_ls_json`: List files inside a directory to extract hashes and IDs.
  - `remarkable_delete`: Delete an entry.
  - `remarkable_move`: Move an entry.
  - `remarkable_rename`: Rename an entry.
  - `remarkable_upload`: Upload documents (.pdf, .epub).
- [YouTube Music Skills](skills/ytmusic/README.md)
  - `ytmusic_list_playlists`: View your playlists and IDs.
  - Granular deduplication and sync tools (see `ytmusic_get_duplicates`, `ytmusic_get_sync_candidates`, etc.).
  - Automatic tools like `ytmusic_deduplicate_playlist_auto` to blindly perform operations.

## Agent Guidelines
When interacting with the `connect` MCP server, agents should:
1. Fetch the exact tool workflow documentation by reading the `skill://remarkable` or `skill://ytmusic` resource.
2. Use `ytmusic_list_playlists` or `remarkable_ls_json` to gather IDs, hashes, and directory paths before running mutating commands.
3. The MCP server operates non-interactively via stdio. For granular YT Music workflows, fetch the candidates first, inspect the JSON, and then issue the execution commands passing the targeted JSON array.
