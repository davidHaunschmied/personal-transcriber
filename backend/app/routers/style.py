from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client

from app.auth import CurrentUser, get_current_user
from app.deps import get_supabase
from app.models import (
    ReferenceSpeech,
    ReferenceSpeechCreate,
    StyleGuide,
    StyleGuideUpdate,
)

router = APIRouter()


@router.get("/guide", response_model=StyleGuide)
def get_style_guide(
    user: CurrentUser = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
) -> StyleGuide:
    res = (
        supabase.table("style_guides")
        .select("content, updated_at")
        .eq("user_id", user.id)
        .maybe_single()
        .execute()
    )
    if not res or not res.data:
        return StyleGuide(content="")
    return StyleGuide(**res.data)


@router.put("/guide", response_model=StyleGuide)
def upsert_style_guide(
    body: StyleGuideUpdate,
    user: CurrentUser = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
) -> StyleGuide:
    res = (
        supabase.table("style_guides")
        .upsert({"user_id": user.id, "content": body.content})
        .execute()
    )
    if not res.data:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "upsert failed")
    row = res.data[0]
    return StyleGuide(content=row["content"], updated_at=row.get("updated_at"))


@router.get("/references", response_model=list[ReferenceSpeech])
def list_references(
    user: CurrentUser = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
) -> list[ReferenceSpeech]:
    res = (
        supabase.table("reference_speeches")
        .select("id, title, content, created_at")
        .eq("user_id", user.id)
        .order("created_at", desc=True)
        .execute()
    )
    return [ReferenceSpeech(**row) for row in (res.data or [])]


@router.post("/references", response_model=ReferenceSpeech, status_code=status.HTTP_201_CREATED)
def create_reference(
    body: ReferenceSpeechCreate,
    user: CurrentUser = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
) -> ReferenceSpeech:
    res = (
        supabase.table("reference_speeches")
        .insert({"user_id": user.id, "title": body.title, "content": body.content})
        .execute()
    )
    if not res.data:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "insert failed")
    return ReferenceSpeech(**res.data[0])


@router.delete("/references/{reference_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_reference(
    reference_id: str,
    user: CurrentUser = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
) -> None:
    res = (
        supabase.table("reference_speeches")
        .delete()
        .eq("id", reference_id)
        .eq("user_id", user.id)
        .execute()
    )
    if not res.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "reference not found")
