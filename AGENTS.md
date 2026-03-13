# Connect Agents & Skills

This document describes the various agent skills available in this project and where to find them. The functionalities of `connect` are exposed both via CLI tools and through a unified Model Context Protocol (MCP) server (`src/mcp-server.js`).

## What is an MCP Server?

The included MCP Server allows AI agents to interface directly with the functionalities implemented in this project. The server exposes a set of non-interactive tools to manage reMarkable and YouTube Music.

**To run the MCP server locally:**

```bash
node src/mcp-server.js
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

Skills are organized by their purpose into two directories:
- `mcp-skills/`: Skills that are served to the user via the MCP server.
- `development-skills/`: Skills that are used during development (e.g., creating other skills, codebase formatting rules, etc.).

The MCP server exposes the documentation for the MCP skills directly as resources that an AI agent can read dynamically:

- `skill://remarkable`: Returns the markdown contents of `mcp-skills/remarkable/README.md`.
- `skill://ytmusic`: Returns the markdown contents of `mcp-skills/ytmusic/README.md`.
- `skill://utility`: Returns the markdown contents of `mcp-skills/utility/README.md`.

Alternatively, you can read the files directly here:

- [reMarkable Skills](mcp-skills/remarkable/README.md)
  - `remarkable_ls_json`: List files inside a directory to extract hashes and IDs.
  - `remarkable_delete`: Delete an entry.
  - `remarkable_move`: Move an entry.
  - `remarkable_rename`: Rename an entry.
  - `remarkable_upload`: Upload documents (.pdf, .epub).
- [YouTube Music Skills](mcp-skills/ytmusic/README.md)
  - `ytmusic_list_playlists`: View your playlists and IDs.
  - Granular deduplication and sync tools (see `ytmusic_get_duplicates`, `ytmusic_get_sync_candidates`, etc.).
  - Automatic tools like `ytmusic_deduplicate_playlist_auto` to blindly perform operations.
- [Utility Skills](mcp-skills/utility/README.md)
  - `util_reflow_pdf`: Reflows a PDF to be more readable on a tablet.
  - `util_markdown_to_pdf`: Converts a Markdown file to PDF.

## Agent Guidelines

When interacting with the `connect` MCP server, agents should refer to the guidelines defined in the `connect-mcp` skill located at `development-skills/connect-mcp/SKILL.md`.

**Docker Path Warning**: When using tools that accept or return local file paths (such as `remarkable_upload` or `util_reflow_pdf`), you MUST bear in mind that the MCP server runs inside a Docker container. Do not use absolute paths from your host machine (e.g. `/Users/name/...`). Instead, always use paths mapped to the container's mounted volume, such as `/app/data/my_file.pdf`, ensuring the file actually exists within the `data/` directory.
