import logging

from supabase import Client

from app.config import Settings
from app.services import groq_client, llm_client, storage

logger = logging.getLogger(__name__)


def transcribe_recording(
    *,
    supabase: Client,
    settings: Settings,
    recording_id: str,
) -> None:
    """Background task: download audio, call Groq, update recording row."""
    try:
        supabase.table("recordings").update({"status": "transcribing", "error": None}).eq(
            "id", recording_id
        ).execute()

        row = (
            supabase.table("recordings")
            .select("storage_path, original_filename")
            .eq("id", recording_id)
            .single()
            .execute()
        )
        if not row.data:
            raise RuntimeError(f"recording {recording_id} not found")
        path = row.data["storage_path"]
        filename = row.data["original_filename"]

        audio = storage.download_audio(supabase, settings, path)
        if len(audio) > settings.max_audio_bytes:
            raise RuntimeError(
                f"audio file too large ({len(audio)} bytes, max {settings.max_audio_bytes})"
            )

        text = groq_client.transcribe(audio, filename, settings)

        supabase.table("recordings").update(
            {"status": "transcribed", "transcript": text, "error": None}
        ).eq("id", recording_id).execute()
    except Exception as exc:
        logger.exception("transcribe_recording failed for %s", recording_id)
        supabase.table("recordings").update(
            {"status": "failed", "error": str(exc)}
        ).eq("id", recording_id).execute()


def run_transformation(
    *,
    supabase: Client,
    settings: Settings,
    transformation_id: str,
) -> None:
    """Background task: load context + transcript, call Groq LLM, update row."""
    try:
        supabase.table("transformations").update({"status": "running", "error": None}).eq(
            "id", transformation_id
        ).execute()

        tx = (
            supabase.table("transformations")
            .select("recording_id, user_id, prompt_used, model")
            .eq("id", transformation_id)
            .single()
            .execute()
        )
        if not tx.data:
            raise RuntimeError(f"transformation {transformation_id} not found")
        recording_id = tx.data["recording_id"]
        user_id = tx.data["user_id"]
        prompt_used = tx.data["prompt_used"]
        model = tx.data["model"]

        rec = (
            supabase.table("recordings")
            .select("transcript, status")
            .eq("id", recording_id)
            .single()
            .execute()
        )
        if not rec.data:
            raise RuntimeError(f"recording {recording_id} not found")
        if rec.data["status"] != "transcribed" or not rec.data.get("transcript"):
            raise RuntimeError("recording is not transcribed yet")
        transcript = rec.data["transcript"]

        sg = (
            supabase.table("style_guides")
            .select("content")
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
        style_guide = (sg.data or {}).get("content", "") if sg else ""

        refs = (
            supabase.table("reference_speeches")
            .select("title, content")
            .eq("user_id", user_id)
            .order("created_at")
            .execute()
        )
        reference_speeches = refs.data or []

        output = llm_client.transform(
            settings=settings,
            model=model,
            style_guide=style_guide,
            reference_speeches=reference_speeches,
            user_prompt=prompt_used,
            transcript=transcript,
        )

        supabase.table("transformations").update(
            {"status": "done", "output": output, "error": None}
        ).eq("id", transformation_id).execute()
    except Exception as exc:
        logger.exception("run_transformation failed for %s", transformation_id)
        supabase.table("transformations").update(
            {"status": "failed", "error": str(exc)}
        ).eq("id", transformation_id).execute()
