from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from supabase import Client

from app.auth import CurrentUser, get_current_user
from app.config import Settings, get_settings
from app.deps import get_supabase
from app.models import Transformation, TransformationCreate
from app.pipeline import run_transformation

router = APIRouter()


@router.post("", response_model=Transformation, status_code=status.HTTP_201_CREATED)
def create_transformation(
    body: TransformationCreate,
    background: BackgroundTasks,
    user: CurrentUser = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
    settings: Settings = Depends(get_settings),
) -> Transformation:
    rec = (
        supabase.table("recordings")
        .select("id, status")
        .eq("id", body.recording_id)
        .eq("user_id", user.id)
        .maybe_single()
        .execute()
    )
    if not rec or not rec.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "recording not found")
    if rec.data["status"] != "transcribed":
        raise HTTPException(status.HTTP_409_CONFLICT, "recording is not transcribed yet")

    prompt = body.prompt
    model = body.model
    template_id = body.template_id

    if template_id:
        tpl = (
            supabase.table("prompt_templates")
            .select("id, prompt, model")
            .eq("id", template_id)
            .eq("user_id", user.id)
            .maybe_single()
            .execute()
        )
        if not tpl or not tpl.data:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "template not found")
        prompt = prompt or tpl.data["prompt"]
        model = model or tpl.data["model"]

    if not prompt:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "prompt or template_id required")

    model = model or settings.default_transformation_model

    insert = (
        supabase.table("transformations")
        .insert(
            {
                "recording_id": body.recording_id,
                "user_id": user.id,
                "template_id": template_id,
                "prompt_used": prompt,
                "model": model,
                "status": "pending",
            }
        )
        .execute()
    )
    if not insert.data:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "insert failed")
    row = insert.data[0]

    background.add_task(
        run_transformation,
        supabase=supabase,
        settings=settings,
        transformation_id=row["id"],
    )
    return Transformation(**row)


@router.get("", response_model=list[Transformation])
def list_for_recording(
    recording_id: str,
    user: CurrentUser = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
) -> list[Transformation]:
    res = (
        supabase.table("transformations")
        .select("*")
        .eq("recording_id", recording_id)
        .eq("user_id", user.id)
        .order("created_at", desc=True)
        .execute()
    )
    return [Transformation(**row) for row in (res.data or [])]


@router.get("/{transformation_id}", response_model=Transformation)
def get_transformation(
    transformation_id: str,
    user: CurrentUser = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
) -> Transformation:
    res = (
        supabase.table("transformations")
        .select("*")
        .eq("id", transformation_id)
        .eq("user_id", user.id)
        .maybe_single()
        .execute()
    )
    if not res or not res.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "transformation not found")
    return Transformation(**res.data)


@router.delete("/{transformation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_transformation(
    transformation_id: str,
    user: CurrentUser = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
) -> None:
    res = (
        supabase.table("transformations")
        .delete()
        .eq("id", transformation_id)
        .eq("user_id", user.id)
        .execute()
    )
    if not res.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "transformation not found")
