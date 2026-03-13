import json
import os
import sys
from typing import Any

from invoke.context import Context
from invoke.tasks import task

DATA_DIR = os.environ.get("DATA_DIR", os.path.join(os.getcwd(), "data"))
os.makedirs(DATA_DIR, exist_ok=True)

AUTH_FILE = os.path.join(DATA_DIR, "browser.json")


def get_ytmusic() -> Any:
    from ytmusicapi import YTMusic

    if not os.path.exists(AUTH_FILE):
        print("Authentication file not found.")
        print("Please run 'uv run invoke auth' first to authenticate.")
        sys.exit(1)

    return YTMusic(AUTH_FILE)


@task
def auth(c: Context) -> None:
    """Authenticate with YouTube Music using browser headers and save to browser.json"""
    headers_file = os.path.join(DATA_DIR, "headers.txt")

    if os.path.exists(headers_file):
        print(f"Found {headers_file}. Reading headers...")
        with open(headers_file, "r") as f:
            headers_raw = f.read()
    else:
        print(f"Starting authentication. This will generate {AUTH_FILE}.")
        print(
            "Due to a bug on YouTube's servers with OAuth, we will use Browser Authentication."
        )
        print("1. Open Chrome/Firefox and go to https://music.youtube.com")
        print("2. Open Developer Tools (F12) -> Network tab")
        print("3. Refresh the page and find any request to music.youtube.com")
        print("4. Right click the request -> Copy -> Copy Request Headers")
        print(
            f"5. Paste the headers below OR save them to '{headers_file}' and run this again."
        )
        print("(Press Enter, then Ctrl-D or Ctrl-Z to save pasted headers):")

        lines = sys.stdin.readlines()
        headers_raw = "".join(lines)
        if not headers_raw.strip():
            print("No headers provided. Aborting.")
            return

    from ytmusicapi.auth.browser import setup_browser

    try:
        setup_browser(filepath=AUTH_FILE, headers_raw=headers_raw)
        print(f"\nAuthentication successfully saved to {AUTH_FILE}")
    except Exception as e:
        print(f"\nError setting up authentication: {e}")


@task
def list_playlists(c: Context) -> None:
    """Return all the playlist names and IDs"""
    yt = get_ytmusic()
    # Fetch all library playlists
    playlists = yt.get_library_playlists(limit=None)
    print(f"Found {len(playlists)} playlists:")
    for p in playlists:
        title = p.get("title")
        pid = p.get("playlistId")
        print(f" - {title} (ID: {pid})")


@task(
    help={
        "playlist_id": "The ID of the YouTube Music playlist to check for duplicates",
        "auto": "Automatically remove without prompting",
    }
)
def deduplicate_playlist(c: Context, playlist_id: str, auto: bool = False) -> None:
    """Find duplicates inside a specific playlist and prompt for removal"""
    yt = get_ytmusic()
    import questionary

    try:
        playlist = yt.get_playlist(playlist_id, limit=None)
    except Exception as e:
        print(f"Error fetching playlist {playlist_id}: {e}")
        return

    title = playlist.get("title", "Unknown Title")
    tracks = playlist.get("tracks", [])
    print(f"Playlist: '{title}' ({len(tracks)} tracks)")

    seen_video_ids = set()
    duplicates = []

    for track in tracks:
        vid = track.get("videoId")
        # Some tracks might be unavailable or have no videoId
        if not vid:
            continue

        if vid in seen_video_ids:
            track_title = track.get("title", "Unknown Track")
            artists_list = track.get("artists") or []
            artists = ", ".join(
                [a.get("name", "") for a in artists_list if a.get("name")]
            )
            if not artists:
                artists = "Unknown Artist"

            duplicates.append({"name": f"{track_title} by {artists}", "value": track})
        else:
            seen_video_ids.add(vid)

    if not duplicates:
        print(f"\nNo duplicates found in '{title}'.")
        return

    print(f"\nFound {len(duplicates)} duplicate tracks.")

    if auto:
        to_remove_tracks = [t["value"] for t in duplicates]
    else:
        choices = [
            questionary.Choice(title=t["name"], value=t["value"]) for t in duplicates
        ]

        to_remove_tracks = questionary.checkbox(
            "Select duplicate tracks to REMOVE (Space to toggle, 'a' to select all, Enter to confirm/skip all):",
            choices=choices,
        ).ask()

        if to_remove_tracks is None:
            print("Operation aborted.")
            return

    to_remove = []
    for track in to_remove_tracks:
        vid = track.get("videoId")
        set_video_id = track.get("setVideoId")
        if set_video_id:
            to_remove.append({"videoId": vid, "setVideoId": set_video_id})
        else:
            print(f"Cannot remove '{track.get('title')}' (missing setVideoId).")

    if to_remove:
        print(f"\nRemoving {len(to_remove)} duplicates from '{title}'...")
        try:
            yt.remove_playlist_items(playlist_id, to_remove)
            print("Successfully removed duplicates.")
        except Exception as e:
            print(f"Error removing duplicates: {e}")
    else:
        print(f"\nNo duplicates removed from '{title}'.")


@task
def deduplicate_all(c: Context) -> None:
    """Find duplicates inside all library playlists and prompt for removal"""
    yt = get_ytmusic()
    playlists = yt.get_library_playlists(limit=None)

    for p in playlists:
        title = p.get("title")
        pid = p.get("playlistId")
        print(f"\n=== Checking Playlist: {title} ===")
        # We can only edit playlists we own (usually starts with PL or VL)
        # To avoid errors, we can just ask if the user wants to check it
        while True:
            ans = input(f"Check '{title}' for duplicates? (y/n/q): ").strip().lower()
            if ans in ["y", "n", "q"]:
                break
            print("Please enter 'y', 'n', or 'q'.")

        if ans == "q":
            print("Aborting all operations.")
            break
        elif ans == "y":
            deduplicate_playlist(c, pid)


@task(
    help={
        "primary": "The ID of the primary playlist",
        "secondary": "Comma-separated list of secondary playlist IDs",
        "auto": "Automatically add missing tracks to primary and remove from secondary without prompting",
    }
)
def sync_playlists(
    c: Context, primary: str, secondary: str, auto: bool = False
) -> None:
    """Find songs in secondary playlists that are not in the primary playlist and prompt for action"""
    yt = get_ytmusic()
    import questionary

    try:
        primary_playlist = yt.get_playlist(primary, limit=None)
    except Exception as e:
        print(f"Error fetching primary playlist {primary}: {e}")
        return

    primary_title = primary_playlist.get("title", "Unknown Title")
    primary_tracks = primary_playlist.get("tracks", [])
    print(f"Primary Playlist: '{primary_title}' ({len(primary_tracks)} tracks)")

    primary_video_ids = set(
        track.get("videoId") for track in primary_tracks if track.get("videoId")
    )

    secondary_ids = [pid.strip() for pid in secondary.split(",") if pid.strip()]

    for sec_id in secondary_ids:
        try:
            sec_playlist = yt.get_playlist(sec_id, limit=None)
        except Exception as e:
            print(f"Error fetching secondary playlist {sec_id}: {e}")
            continue

        sec_title = sec_playlist.get("title", "Unknown Title")
        sec_tracks = sec_playlist.get("tracks", [])
        print(
            f"\n=== Checking Secondary Playlist: '{sec_title}' ({len(sec_tracks)} tracks) ==="
        )

        not_in_primary = []
        for track in sec_tracks:
            vid = track.get("videoId")
            if not vid:
                continue

            if vid not in primary_video_ids:
                track_title = track.get("title", "Unknown Track")
                artists_list = track.get("artists") or []
                artists = ", ".join(
                    [a.get("name", "") for a in artists_list if a.get("name")]
                )
                if not artists:
                    artists = "Unknown Artist"

                not_in_primary.append(
                    {"name": f"{track_title} by {artists}", "value": track}
                )

        if not not_in_primary:
            print(
                "All tracks from this secondary playlist are already in the primary playlist."
            )
            continue

        print(f"Found {len(not_in_primary)} tracks not in primary playlist.")

        if auto:
            to_add_tracks = [t["value"] for t in not_in_primary]
            to_remove_tracks = [t["value"] for t in not_in_primary]
        else:
            # 1. Prompt for ADD to primary
            add_choices = [
                questionary.Choice(title=t["name"], value=t["value"])
                for t in not_in_primary
            ]

            to_add_tracks = questionary.checkbox(
                "Select tracks to ADD to primary playlist (Space to toggle, 'a' to select all, Enter to confirm/skip all):",
                choices=add_choices,
            ).ask()

            if to_add_tracks is None:  # User cancelled (Ctrl-C)
                print("Operation aborted.")
                return

            # 2. Prompt for REMOVE from secondary
            remove_choices = []
            for t in not_in_primary:
                # We can still offer to remove it even if it was added to primary,
                # so we show all of them.
                remove_choices.append(
                    questionary.Choice(title=t["name"], value=t["value"])
                )

            to_remove_tracks = questionary.checkbox(
                "Select tracks to REMOVE from secondary playlist (Space to toggle, 'a' to select all, Enter to confirm/skip all):",
                choices=remove_choices,
            ).ask()

            if to_remove_tracks is None:  # User cancelled
                print("Operation aborted.")
                return

        to_add_vids = [t.get("videoId") for t in to_add_tracks]
        to_remove = []
        for track in to_remove_tracks:
            vid = track.get("videoId")
            set_video_id = track.get("setVideoId")
            if set_video_id:
                to_remove.append({"videoId": vid, "setVideoId": set_video_id})
            else:
                print(f"Cannot remove '{track.get('title')}' (missing setVideoId).")

        if to_add_vids:
            print(
                f"\nAdding {len(to_add_vids)} tracks to primary playlist '{primary_title}'..."
            )
            try:
                yt.add_playlist_items(primary, to_add_vids)
                print("Successfully added tracks.")
                primary_video_ids.update(to_add_vids)
            except Exception as e:
                print(f"Error adding tracks: {e}")

        if to_remove:
            print(
                f"\nRemoving {len(to_remove)} tracks from secondary playlist '{sec_title}'..."
            )
            try:
                yt.remove_playlist_items(sec_id, to_remove)
                print("Successfully removed tracks.")
            except Exception as e:
                print(f"Error removing tracks: {e}")


@task(
    help={
        "primary": "The ID of the primary playlist",
        "secondary": "Comma-separated list of secondary playlist IDs",
        "auto": "Automatically distribute to secondary playlists without prompting",
    }
)
def distribute_primary(
    c: Context, primary: str, secondary: str, auto: bool = False
) -> None:
    """Find songs in primary that are missing from secondary playlists and prompt to add them"""
    yt = get_ytmusic()
    import questionary

    try:
        primary_playlist = yt.get_playlist(primary, limit=None)
    except Exception as e:
        print(f"Error fetching primary playlist {primary}: {e}")
        return

    primary_title = primary_playlist.get("title", "Unknown Title")
    primary_tracks = primary_playlist.get("tracks", [])
    print(f"Primary Playlist: '{primary_title}' ({len(primary_tracks)} tracks)")

    primary_valid_tracks = [t for t in primary_tracks if t.get("videoId")]

    secondary_ids = [pid.strip() for pid in secondary.split(",") if pid.strip()]

    for sec_id in secondary_ids:
        try:
            sec_playlist = yt.get_playlist(sec_id, limit=None)
        except Exception as e:
            print(f"Error fetching secondary playlist {sec_id}: {e}")
            continue

        sec_title = sec_playlist.get("title", "Unknown Title")
        sec_tracks = sec_playlist.get("tracks", [])
        print(
            f"\n=== Checking Secondary Playlist: '{sec_title}' ({len(sec_tracks)} tracks) ==="
        )

        sec_video_ids = set(
            track.get("videoId") for track in sec_tracks if track.get("videoId")
        )

        missing_in_sec = []
        for track in primary_valid_tracks:
            vid = track.get("videoId")
            if vid not in sec_video_ids:
                track_title = track.get("title", "Unknown Track")
                artists_list = track.get("artists") or []
                artists = ", ".join(
                    [a.get("name", "") for a in artists_list if a.get("name")]
                )
                if not artists:
                    artists = "Unknown Artist"

                missing_in_sec.append(
                    {"name": f"{track_title} by {artists}", "value": track}
                )

        if not missing_in_sec:
            print(f"All tracks from the primary playlist are already in '{sec_title}'.")
            continue

        print(
            f"Found {len(missing_in_sec)} tracks from primary missing in '{sec_title}'."
        )

        if auto:
            to_add_tracks = [t["value"] for t in missing_in_sec]
        else:
            add_choices = [
                questionary.Choice(title=t["name"], value=t["value"])
                for t in missing_in_sec
            ]

            to_add_tracks = questionary.checkbox(
                f"Select tracks from primary to ADD to '{sec_title}' (Space to toggle, 'a' to select all, Enter to confirm/skip all):",
                choices=add_choices,
            ).ask()

            if to_add_tracks is None:
                print("Operation aborted.")
                return

        to_add_vids = [t.get("videoId") for t in to_add_tracks]

        if to_add_vids:
            print(f"\nAdding {len(to_add_vids)} tracks to '{sec_title}'...")
            try:
                yt.add_playlist_items(sec_id, to_add_vids)
                print("Successfully added tracks.")
            except Exception as e:
                print(f"Error adding tracks: {e}")


# --- MCP JSON Tasks ---


@task
def mcp_get_duplicates(c: Context, playlist_id: str) -> None:
    """Return JSON list of duplicate tracks in a playlist"""
    yt = get_ytmusic()
    try:
        playlist = yt.get_playlist(playlist_id, limit=None)
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        return

    seen_video_ids = set()
    duplicates = []
    for track in playlist.get("tracks", []):
        vid = track.get("videoId")
        if not vid:
            continue
        if vid in seen_video_ids:
            duplicates.append(track)
        else:
            seen_video_ids.add(vid)
    print(json.dumps(duplicates))


@task(help={"playlist_id": "", "tracks_json": "JSON string of track objects"})
def mcp_remove_duplicates(c: Context, playlist_id: str, tracks_json: str) -> None:
    """Remove specific duplicate tracks using JSON input"""
    yt = get_ytmusic()
    try:
        tracks = json.loads(tracks_json)
        to_remove = [
            {"videoId": t.get("videoId"), "setVideoId": t.get("setVideoId")}
            for t in tracks
            if t.get("videoId") and t.get("setVideoId")
        ]
        if to_remove:
            yt.remove_playlist_items(playlist_id, to_remove)
            print(json.dumps({"success": True, "removed": len(to_remove)}))
        else:
            print(
                json.dumps(
                    {
                        "success": False,
                        "error": "No valid tracks with setVideoId provided",
                    }
                )
            )
    except Exception as e:
        print(json.dumps({"error": str(e)}))


@task
def mcp_get_sync_candidates(c: Context, primary: str, secondary: str) -> None:
    """Return JSON list of tracks in secondary but not in primary"""
    yt = get_ytmusic()
    try:
        primary_playlist = yt.get_playlist(primary, limit=None)
        sec_playlist = yt.get_playlist(secondary, limit=None)
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        return

    primary_vids = set(
        t.get("videoId") for t in primary_playlist.get("tracks", []) if t.get("videoId")
    )
    not_in_primary = [
        t
        for t in sec_playlist.get("tracks", [])
        if t.get("videoId") and t.get("videoId") not in primary_vids
    ]
    print(json.dumps(not_in_primary))


@task(help={"primary": "", "tracks_json": "JSON string of track objects"})
def mcp_sync_add(c: Context, primary: str, tracks_json: str) -> None:
    """Add tracks to primary playlist using JSON input"""
    yt = get_ytmusic()
    try:
        tracks = json.loads(tracks_json)
        vids = [t.get("videoId") for t in tracks if t.get("videoId")]
        if vids:
            yt.add_playlist_items(primary, vids)
            print(json.dumps({"success": True, "added": len(vids)}))
        else:
            print(json.dumps({"success": False, "error": "No valid tracks provided"}))
    except Exception as e:
        print(json.dumps({"error": str(e)}))


@task(help={"secondary": "", "tracks_json": "JSON string of track objects"})
def mcp_sync_remove(c: Context, secondary: str, tracks_json: str) -> None:
    """Remove tracks from secondary playlist using JSON input"""
    yt = get_ytmusic()
    try:
        tracks = json.loads(tracks_json)
        to_remove = [
            {"videoId": t.get("videoId"), "setVideoId": t.get("setVideoId")}
            for t in tracks
            if t.get("videoId") and t.get("setVideoId")
        ]
        if to_remove:
            yt.remove_playlist_items(secondary, to_remove)
            print(json.dumps({"success": True, "removed": len(to_remove)}))
        else:
            print(
                json.dumps(
                    {
                        "success": False,
                        "error": "No valid tracks with setVideoId provided",
                    }
                )
            )
    except Exception as e:
        print(json.dumps({"error": str(e)}))


@task
def mcp_get_distribute_candidates(c: Context, primary: str, secondary: str) -> None:
    """Return JSON list of tracks in primary but not in secondary"""
    yt = get_ytmusic()
    try:
        primary_playlist = yt.get_playlist(primary, limit=None)
        sec_playlist = yt.get_playlist(secondary, limit=None)
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        return

    sec_vids = set(
        t.get("videoId") for t in sec_playlist.get("tracks", []) if t.get("videoId")
    )
    not_in_sec = [
        t
        for t in primary_playlist.get("tracks", [])
        if t.get("videoId") and t.get("videoId") not in sec_vids
    ]
    print(json.dumps(not_in_sec))


@task(help={"secondary": "", "tracks_json": "JSON string of track objects"})
def mcp_distribute_add(c: Context, secondary: str, tracks_json: str) -> None:
    """Add tracks to secondary playlist using JSON input"""
    yt = get_ytmusic()
    try:
        tracks = json.loads(tracks_json)
        vids = [t.get("videoId") for t in tracks if t.get("videoId")]
        if vids:
            yt.add_playlist_items(secondary, vids)
            print(json.dumps({"success": True, "added": len(vids)}))
        else:
            print(json.dumps({"success": False, "error": "No valid tracks provided"}))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
