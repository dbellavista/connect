# reMarkable Skills

This directory contains skills related to managing documents on a reMarkable tablet.

## Available Skills

### List Files (Human Readable)
- **Description**: Lists files and directories in the reMarkable tablet by path.
- **MCP Tool**: `remarkable_list`
- **Usage**: Call the tool with an optional `directory` path (e.g. `/Notes`).

### Granular JSON Listing
- **Description**: List items in a specific directory as JSON. Returns all metadata including IDs and hashes.
- **MCP Tool**: `remarkable_ls_json`
- **Parameters**: 
  - `parent_id`: The ID of the parent directory (default '' for root).
  - `type`: Optional filter ('DocumentType' or 'CollectionType').
- **Usage**: Use this to obtain the `hash` or `id` of files and folders for further operations.

### Delete Entry
- **Description**: Delete an entry on reMarkable.
- **MCP Tool**: `remarkable_delete`
- **Parameters**: `hash` (The current hash of the entry).

### Move Entry
- **Description**: Move an entry to a different directory.
- **MCP Tool**: `remarkable_move`
- **Parameters**: 
  - `hash`: The hash of the entry to move.
  - `target_parent_id`: The ID of the destination directory.

### Rename Entry
- **Description**: Rename an entry on reMarkable.
- **MCP Tool**: `remarkable_rename`
- **Parameters**: 
  - `hash`: The hash of the entry to rename.
  - `new_name`: The new visible name.

### Upload File
- **Description**: Uploads a local PDF or EPUB file to a specific directory on the reMarkable tablet.
- **MCP Tool**: `remarkable_upload`
- **Parameters**: `file_path` (local file) and `directory` (destination path path on the tablet).
