from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from supabase import Client

from app.auth import CurrentUser, get_current_user
from app.config import Settings, get_settings
from app.deps import get_supabase
from app.models import Recording, RecordingRegister, RecordingRegistered, TranscriptUpdate
from app.pipeline import transcribe_recording
from app.services import storage as storage_svc

router = APIRouter()


@router.post("", response_model=RecordingRegistered, status_code=status.HTTP_201_CREATED)
def register_recording(
    body: RecordingRegister,
    user: CurrentUser = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
    settings: Settings = Depends(get_settings),
) -> RecordingRegistered:
    """Create a recording row + signed upload URL. Frontend uploads audio directly to storage."""
    insert = (
        supabase.table("recordings")
        .insert(
            {
                "user_id": user.id,
                "original_filename": body.original_filename,
                "storage_path": "pending",
                "status": "uploaded",
            }
        )
        .execute()
    )
    if not insert.data:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "insert failed")
    row = insert.data[0]
    recording_id = row["id"]

    path = storage_svc.storage_path_for(user.id, recording_id, body.original_filename)
    signed = storage_svc.create_signed_upload_url(supabase, settings, path)

    updated = (
        supabase.table("recordings")
        .update({"storage_path": path})
        .eq("id", recording_id)
        .execute()
    )
    if not updated.data:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "update failed")

    return RecordingRegistered(
        recording=Recording(**updated.data[0]),
        upload_url=signed["upload_url"],
        upload_token=signed["upload_token"],
        storage_path=path,
    )


@router.get("", response_model=list[Recording])
def list_recordings(
    user: CurrentUser = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
) -> list[Recording]:
    res = (
        supabase.table("recordings")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", desc=True)
        .execute()
    )
    return [Recording(**row) for row in (res.data or [])]


@router.get("/{recording_id}", response_model=Recording)
def get_recording(
    recording_id: str,
    user: CurrentUser = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
) -> Recording:
    res = (
        supabase.table("recordings")
        .select("*")
        .eq("id", recording_id)
        .eq("user_id", user.id)
        .maybe_single()
        .execute()
    )
    if not res or not res.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "recording not found")
    return Recording(**res.data)


@router.post("/{recording_id}/transcribe", response_model=Recording)
def trigger_transcribe(
    recording_id: str,
    background: BackgroundTasks,
    user: CurrentUser = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
    settings: Settings = Depends(get_settings),
) -> Recording:
    res = (
        supabase.table("recordings")
        .select("*")
        .eq("id", recording_id)
        .eq("user_id", user.id)
        .maybe_single()
        .execute()
    )
    if not res or not res.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "recording not found")
    if res.data["status"] == "transcribing":
        raise HTTPException(status.HTTP_409_CONFLICT, "already transcribing")

    background.add_task(
        transcribe_recording,
        supabase=supabase,
        settings=settings,
        recording_id=recording_id,
    )
    return Recording(**res.data)


@router.patch("/{recording_id}", response_model=Recording)
def update_transcript(
    recording_id: str,
    body: TranscriptUpdate,
    user: CurrentUser = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
) -> Recording:
    res = (
        supabase.table("recordings")
        .update({"transcript": body.transcript})
        .eq("id", recording_id)
        .eq("user_id", user.id)
        .execute()
    )
    if not res.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "recording not found")
    return Recording(**res.data[0])


@router.delete("/{recording_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_recording(
    recording_id: str,
    user: CurrentUser = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
    settings: Settings = Depends(get_settings),
) -> None:
    res = (
        supabase.table("recordings")
        .select("storage_path")
        .eq("id", recording_id)
        .eq("user_id", user.id)
        .maybe_single()
        .execute()
    )
    if not res or not res.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "recording not found")
    path = res.data["storage_path"]
    if path and path != "pending":
        try:
            supabase.storage.from_(settings.recordings_bucket).remove([path])
        except Exception:
            pass
    supabase.table("recordings").delete().eq("id", recording_id).eq("user_id", user.id).execute()
