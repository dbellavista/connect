import json
import os
import sys

from connect.utils.logger import logger
from invoke.context import Context
from invoke.tasks import task
from ytmusicapi import YTMusic

AUTH_FILE = "data/ytmusic_auth.json"


def get_ytmusic() -> YTMusic:
    """Initialize YTMusic from auth file, or raise error if not authenticated."""
    if not os.path.exists(AUTH_FILE):
        logger.error("Authentication file not found.")
        logger.info("Please run 'uv run invoke youtube.auth' first to authenticate.")
        raise FileNotFoundError(f"{AUTH_FILE} not found")
    return YTMusic(AUTH_FILE)


@task(help={"headers_file": "Path to a file containing raw request headers (optional)"})
def auth(c: Context, headers_file: str = "") -> None:
    """Setup YouTube Music authentication by pasting request headers."""
    if headers_file and os.path.exists(headers_file):
        logger.info(f"Found {headers_file}. Reading headers...")
        with open(headers_file, "r") as f:
            headers_raw = f.read()
    else:
        logger.info(f"Starting authentication. This will generate {AUTH_FILE}.")
        print("-" * 60)
        print("To authenticate:")
        print("1. Open Chrome/Firefox and go to https://music.youtube.com")
        print("2. Open Developer Tools (F12) -> Network tab")
        print("3. Refresh the page and find any request to music.youtube.com")
        print("4. Right click the request -> Copy -> Copy Request Headers")
        print("-" * 60)
        print("\nPaste the headers below and press Ctrl-D (Unix) or Ctrl-Z (Win) to save.")
        print("(Press Enter, then Ctrl-D or Ctrl-Z to save pasted headers):")
        headers_raw = sys.stdin.read()

    if not headers_raw.strip():
        logger.error("No headers provided. Aborting.")
        return

    try:
        YTMusic.setup(filepath=AUTH_FILE, headers_raw=headers_raw)
        logger.info(f"Authentication successfully saved to {AUTH_FILE}")
    except Exception as e:
        logger.error(f"Error setting up authentication: {e}")


@task
def list_playlists(c: Context) -> None:
    """List all your playlists and their IDs."""
    yt = get_ytmusic()
    playlists = yt.get_library_playlists()
    logger.info(f"Found {len(playlists)} playlists:")
    for p in playlists:
        title = p["title"]
        pid = p["playlistId"]
        print(f" - {title} (ID: {pid})")


@task(
    help={
        "playlist_id": "ID of the playlist to deduplicate",
        "auto": "If true, remove duplicates without asking (default: false)",
    }
)
def deduplicate_playlist(c: Context, playlist_id: str, auto: bool = False) -> None:
    """Find and remove duplicate tracks in a playlist."""
    yt = get_ytmusic()
    try:
        playlist = yt.get_playlist(playlist_id)
        title = playlist["title"]
        tracks = playlist["tracks"]
    except Exception as e:
        logger.error(f"Error fetching playlist {playlist_id}: {e}")
        return

    logger.info(f"Playlist: '{title}' ({len(tracks)} tracks)")

    seen_ids = set()
    duplicates = []

    for track in tracks:
        vid = track["videoId"]
        if vid in seen_ids:
            duplicates.append(track)
        else:
            seen_ids.add(vid)

    if not duplicates:
        logger.info(f"No duplicates found in '{title}'.")
        return

    logger.info(f"Found {len(duplicates)} duplicate tracks.")

    to_remove = duplicates

    if not auto:
        confirm = input(
            f"Do you want to remove {len(to_remove)} duplicates from '{title}'? [y/N] "
        )
        if confirm.lower() != "y":
            logger.info("Operation aborted.")
            return

    # ytmusicapi remove_playlist_items expects a list of items with 'videoId' and 'setVideoId'
    # 'setVideoId' is unique for each instance of a track in a playlist.
    to_remove_items = []
    for track in to_remove:
        if "setVideoId" in track:
            to_remove_items.append(track)
        else:
            logger.warning(f"Cannot remove '{track.get('title')}' (missing setVideoId).")

    if to_remove_items:
        logger.info(f"Removing {len(to_remove_items)} duplicates from '{title}'...")
        try:
            yt.remove_playlist_items(playlist_id, to_remove_items)
            logger.info("Successfully removed duplicates.")
        except Exception as e:
            logger.error(f"Error removing duplicates: {e}")
    else:
        logger.info(f"No duplicates removed from '{title}'.")


@task(
    help={
        "primary": "ID of the primary playlist",
        "secondary": "Comma-separated list of secondary playlist IDs",
        "auto": "If true, perform sync without asking (default: false)",
    }
)
def sync_playlists(c: Context, primary: str, secondary: str, auto: bool = False) -> None:
    """Sync secondary playlists TO a primary playlist: add missing, then remove from secondary."""
    yt = get_ytmusic()
    sec_ids = secondary.split(",")

    try:
        primary_playlist = yt.get_playlist(primary)
        primary_title = primary_playlist["title"]
        primary_tracks = primary_playlist["tracks"]
        primary_vids = {t["videoId"] for t in primary_tracks}
    except Exception as e:
        logger.error(f"Error fetching primary playlist {primary}: {e}")
        return

    logger.info(f"Primary Playlist: '{primary_title}' ({len(primary_tracks)} tracks)")

    for sec_id in sec_ids:
        sec_id = sec_id.strip()
        try:
            sec_playlist = yt.get_playlist(sec_id)
            sec_title = sec_playlist["title"]
            sec_tracks = sec_playlist["tracks"]
        except Exception as e:
            logger.error(f"Error fetching secondary playlist {sec_id}: {e}")
            continue

        logger.info(f"\n--- Checking Playlist: {sec_title} ---")
        not_in_primary = [t for t in sec_tracks if t["videoId"] not in primary_vids]

        if not not_in_primary:
            logger.info(f"All tracks from '{sec_title}' are already in the primary playlist.")
            continue

        logger.info(f"Found {len(not_in_primary)} tracks not in primary playlist.")

        if not auto:
            logger.info("\nTracks to add to primary:")
            for t in not_in_primary:
                print(f" - {t['title']} by {', '.join(a['name'] for a in t['artists'])}")

            confirm = ""
            while confirm not in ["y", "n", "q"]:
                confirm = input("\nAdd these tracks to primary and remove from secondary? [y/n/q] ").lower()
            
            if confirm == "n":
                logger.info("Operation aborted.")
                continue
            elif confirm == "q":
                logger.info("Aborting all operations.")
                break

        # 1. Add to primary
        vids = [t["videoId"] for t in not_in_primary]
        if vids:
            logger.info(f"Adding {len(vids)} tracks to '{primary_title}'...")
            try:
                yt.add_playlist_items(primary, vids)
                logger.info("Successfully added tracks.")
            except Exception as e:
                logger.error(f"Error adding tracks: {e}")

            # 2. Remove from secondary
            to_remove = [t for t in not_in_primary if "setVideoId" in t]
            if to_remove:
                logger.info(f"Removing {len(to_remove)} tracks from '{sec_title}'...")
                try:
                    yt.remove_playlist_items(sec_id, to_remove)
                    logger.info("Successfully removed tracks.")
                except Exception as e:
                    logger.error(f"Error removing tracks: {e}")


@task(
    help={
        "primary": "ID of the primary playlist",
        "secondary": "Comma-separated list of secondary playlist IDs",
        "auto": "If true, perform distribution without asking (default: false)",
    }
)
def distribute_primary(
    c: Context, primary: str, secondary: str, auto: bool = False
) -> None:
    """Distribute tracks from the primary playlist to secondary playlists if missing."""
    yt = get_ytmusic()
    sec_ids = secondary.split(",")

    try:
        primary_playlist = yt.get_playlist(primary)
        primary_title = primary_playlist["title"]
        primary_tracks = primary_playlist["tracks"]
    except Exception as e:
        logger.error(f"Error fetching primary playlist {primary}: {e}")
        return

    logger.info(f"Primary Playlist: '{primary_title}' ({len(primary_tracks)} tracks)")

    for sec_id in sec_ids:
        sec_id = sec_id.strip()
        try:
            sec_playlist = yt.get_playlist(sec_id)
            sec_title = sec_playlist["title"]
            sec_tracks = sec_playlist["tracks"]
            sec_vids = {t["videoId"] for t in sec_tracks}
        except Exception as e:
            logger.error(f"Error fetching secondary playlist {sec_id}: {e}")
            continue

        not_in_sec = [t for t in primary_tracks if t["videoId"] not in sec_vids]

        if not not_in_sec:
            logger.info(f"All tracks from the primary playlist are already in '{sec_title}'.")
            continue

        logger.info(f"\nTracks in primary missing from '{sec_title}': {len(not_in_sec)}")

        if not auto:
            for t in not_in_sec:
                print(f" - {t['title']} by {', '.join(a['name'] for a in t['artists'])}")

            confirm = input(f"\nAdd these {len(not_in_sec)} tracks to '{sec_title}'? [y/N] ")
            if confirm.lower() != "y":
                logger.info("Operation aborted.")
                continue

        to_add_vids = [t["videoId"] for t in not_in_sec]
        if to_add_vids:
            logger.info(f"Adding {len(to_add_vids)} tracks to '{sec_title}'...")
            try:
                yt.add_playlist_items(sec_id, to_add_vids)
                logger.info("Successfully added tracks.")
            except Exception as e:
                logger.error(f"Error adding tracks: {e}")


# MCP-compatible JSON-only tools
@task(help={"playlist_id": "ID of the playlist to deduplicate"})
def mcp_get_duplicates(c: Context, playlist_id: str) -> None:
    """Get a JSON list of duplicate tracks in a playlist."""
    yt = get_ytmusic()
    try:
        playlist = yt.get_playlist(playlist_id)
        tracks = playlist["tracks"]
        seen_ids = set()
        duplicates = []
        for track in tracks:
            vid = track["videoId"]
            if vid in seen_ids:
                duplicates.append(track)
            else:
                seen_ids.add(vid)
        print(json.dumps(duplicates))
    except Exception as e:
        logger.error(f"Error in mcp_get_duplicates: {e}")
        print(json.dumps({"error": str(e)}))


@task(
    help={
        "playlist_id": "ID of the playlist",
        "tracks_json": "JSON array of track objects to remove",
    }
)
def mcp_remove_duplicates(c: Context, playlist_id: str, tracks_json: str) -> None:
    """Remove specific duplicate tracks from a playlist (JSON-based)."""
    yt = get_ytmusic()
    try:
        to_remove = json.loads(tracks_json)
        to_remove_items = [t for t in to_remove if "setVideoId" in t]
        if to_remove_items:
            yt.remove_playlist_items(playlist_id, to_remove_items)
            print(json.dumps({"success": True, "removed": len(to_remove_items)}))
        else:
            print(json.dumps({"success": False, "error": "No valid tracks provided"}))
    except Exception as e:
        logger.error(f"Error in mcp_remove_duplicates: {e}")
        print(json.dumps({"error": str(e)}))


@task(
    help={
        "primary": "ID of primary playlist",
        "secondary": "ID of secondary playlist",
    }
)
def mcp_get_sync_candidates(c: Context, primary: str, secondary: str) -> None:
    """Get tracks in secondary that are missing from primary."""
    yt = get_ytmusic()
    try:
        prim_playlist = yt.get_playlist(primary)
        prim_vids = {t["videoId"] for t in prim_playlist["tracks"]}
        sec_playlist = yt.get_playlist(secondary)
        not_in_primary = [t for t in sec_playlist["tracks"] if t["videoId"] not in prim_vids]
        print(json.dumps(not_in_primary))
    except Exception as e:
        logger.error(f"Error in mcp_get_sync_candidates: {e}")
        print(json.dumps({"error": str(e)}))


@task(
    help={
        "primary": "ID of primary playlist",
        "tracks_json": "JSON array of track objects to add",
    }
)
def mcp_sync_add(c: Context, primary: str, tracks_json: str) -> None:
    """Add specific tracks to primary playlist (JSON-based)."""
    yt = get_ytmusic()
    try:
        to_add = json.loads(tracks_json)
        vids = [t["videoId"] for t in to_add]
        if vids:
            yt.add_playlist_items(primary, vids)
            print(json.dumps({"success": True, "added": len(vids)}))
        else:
            print(json.dumps({"success": False, "error": "No valid tracks provided"}))
    except Exception as e:
        logger.error(f"Error in mcp_sync_add: {e}")
        print(json.dumps({"error": str(e)}))


@task(
    help={
        "secondary": "ID of secondary playlist",
        "tracks_json": "JSON array of track objects to remove",
    }
)
def mcp_sync_remove(c: Context, secondary: str, tracks_json: str) -> None:
    """Remove specific tracks from secondary playlist (JSON-based)."""
    yt = get_ytmusic()
    try:
        to_remove = json.loads(tracks_json)
        to_remove_items = [t for t in to_remove if "setVideoId" in t]
        if to_remove_items:
            yt.remove_playlist_items(secondary, to_remove_items)
            print(json.dumps({"success": True, "removed": len(to_remove_items)}))
        else:
            print(json.dumps({"success": False, "error": "No valid tracks provided"}))
    except Exception as e:
        logger.error(f"Error in mcp_sync_remove: {e}")
        print(json.dumps({"error": str(e)}))


@task(
    help={
        "primary": "ID of primary playlist",
        "secondary": "ID of secondary playlist",
    }
)
def mcp_get_distribute_candidates(c: Context, primary: str, secondary: str) -> None:
    """Get tracks in primary that are missing from secondary."""
    yt = get_ytmusic()
    try:
        sec_playlist = yt.get_playlist(secondary)
        sec_vids = {t["videoId"] for t in sec_playlist["tracks"]}
        prim_playlist = yt.get_playlist(primary)
        not_in_sec = [t for t in prim_playlist["tracks"] if t["videoId"] not in sec_vids]
        print(json.dumps(not_in_sec))
    except Exception as e:
        logger.error(f"Error in mcp_get_distribute_candidates: {e}")
        print(json.dumps({"error": str(e)}))


@task(
    help={
        "secondary": "ID of secondary playlist",
        "tracks_json": "JSON array of track objects to add",
    }
)
def mcp_distribute_add(c: Context, secondary: str, tracks_json: str) -> None:
    """Add specific tracks to secondary playlist (JSON-based)."""
    yt = get_ytmusic()
    try:
        to_add = json.loads(tracks_json)
        vids = [t["videoId"] for t in to_add]
        if vids:
            yt.add_playlist_items(secondary, vids)
            print(json.dumps({"success": True, "added": len(vids)}))
        else:
            print(json.dumps({"success": False, "error": "No valid tracks provided"}))
    except Exception as e:
        logger.error(f"Error in mcp_distribute_add: {e}")
        print(json.dumps({"error": str(e)}))
