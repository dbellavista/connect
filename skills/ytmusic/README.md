# YouTube Music Skills

This directory contains skills related to managing your YouTube Music library, playlists, and track synchronization.

## Available Skills

### List Playlists
- **Description**: List all YouTube Music playlists and their IDs.
- **MCP Tool**: `ytmusic_list_playlists`

---

## Interactive / Granular Workflow
These tools allow an AI agent to inspect the tracks before making any modifications. The agent can filter the returned JSON and pass a modified array back to the execution tools.

### Deduplication
1. **`ytmusic_get_duplicates`**: Returns a JSON array of duplicate tracks in a playlist.
2. **`ytmusic_remove_duplicates`**: Takes the `playlist_id` and the `tracks_json` (the exact JSON array of tracks you want to delete) and removes them.

### Playlist Synchronization
Synchronizing implies taking tracks from a secondary playlist, adding them to the primary, and removing them from the secondary.
1. **`ytmusic_get_sync_candidates`**: Returns a JSON array of tracks present in the secondary playlist but missing from the primary playlist.
2. **`ytmusic_sync_add_to_primary`**: Adds selected tracks (via `tracks_json`) to the primary playlist.
3. **`ytmusic_sync_remove_from_secondary`**: Removes selected tracks (via `tracks_json`) from the secondary playlist.

### Playlist Distribution
Distributing implies pushing tracks from a primary playlist to secondary playlists.
1. **`ytmusic_get_distribute_candidates`**: Returns a JSON array of tracks present in the primary playlist but missing from the secondary playlist.
2. **`ytmusic_distribute_add_to_secondary`**: Adds selected tracks (via `tracks_json`) to the secondary playlist.

---

## Fully Automatic Workflow
If you want the agent to handle everything automatically without inspecting individual tracks, you can use these blunt-force tools:

- **`ytmusic_deduplicate_playlist_auto`**: Automatically deletes all duplicates in a given playlist.
- **`ytmusic_sync_playlists_auto`**: Automatically adds all missing tracks to the primary playlist and removes them from multiple secondary playlists (supports comma-separated list of secondary IDs).
- **`ytmusic_distribute_primary_auto`**: Automatically pushes all missing primary tracks to multiple secondary playlists.
