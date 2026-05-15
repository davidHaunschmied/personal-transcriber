from datetime import datetime, timezone

from supabase import Client

from app.config import Settings


def storage_path_for(user_id: str, recording_id: str, filename: str) -> str:
    suffix = filename.rsplit(".", 1)[-1].lower() if "." in filename else "bin"
    safe_suffix = "".join(c for c in suffix if c.isalnum())[:8] or "bin"
    return f"{user_id}/{recording_id}.{safe_suffix}"


def create_signed_upload_url(supabase: Client, settings: Settings, path: str) -> dict:
    """Create a signed upload URL the browser can PUT to directly."""
    result = supabase.storage.from_(settings.recordings_bucket).create_signed_upload_url(path)
    # supabase-py returns {"signed_url": ..., "token": ..., "path": ...}
    return {
        "upload_url": result.get("signed_url") or result.get("signedUrl") or result.get("signedURL"),
        "upload_token": result.get("token"),
        "path": result.get("path", path),
    }


def download_audio(supabase: Client, settings: Settings, path: str) -> bytes:
    return supabase.storage.from_(settings.recordings_bucket).download(path)


def utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
