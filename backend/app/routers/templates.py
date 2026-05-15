from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client

from app.auth import CurrentUser, get_current_user
from app.config import Settings, get_settings
from app.deps import get_supabase
from app.models import PromptTemplate, PromptTemplateCreate, PromptTemplateUpdate

router = APIRouter()


def _clear_other_defaults(supabase: Client, user_id: str, except_id: str | None) -> None:
    q = supabase.table("prompt_templates").update({"is_default": False}).eq("user_id", user_id).eq(
        "is_default", True
    )
    if except_id is not None:
        q = q.neq("id", except_id)
    q.execute()


@router.get("", response_model=list[PromptTemplate])
def list_templates(
    user: CurrentUser = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
) -> list[PromptTemplate]:
    res = (
        supabase.table("prompt_templates")
        .select("id, name, prompt, model, is_default, created_at")
        .eq("user_id", user.id)
        .order("created_at", desc=True)
        .execute()
    )
    return [PromptTemplate(**row) for row in (res.data or [])]


@router.post("", response_model=PromptTemplate, status_code=status.HTTP_201_CREATED)
def create_template(
    body: PromptTemplateCreate,
    user: CurrentUser = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
    settings: Settings = Depends(get_settings),
) -> PromptTemplate:
    model = body.model or settings.default_transformation_model
    res = (
        supabase.table("prompt_templates")
        .insert(
            {
                "user_id": user.id,
                "name": body.name,
                "prompt": body.prompt,
                "model": model,
                "is_default": body.is_default,
            }
        )
        .execute()
    )
    if not res.data:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "insert failed")
    row = res.data[0]
    if body.is_default:
        _clear_other_defaults(supabase, user.id, except_id=row["id"])
    return PromptTemplate(**row)


@router.patch("/{template_id}", response_model=PromptTemplate)
def update_template(
    template_id: str,
    body: PromptTemplateUpdate,
    user: CurrentUser = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
) -> PromptTemplate:
    patch = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    if not patch:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "no fields to update")
    res = (
        supabase.table("prompt_templates")
        .update(patch)
        .eq("id", template_id)
        .eq("user_id", user.id)
        .execute()
    )
    if not res.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "template not found")
    row = res.data[0]
    if patch.get("is_default"):
        _clear_other_defaults(supabase, user.id, except_id=template_id)
    return PromptTemplate(**row)


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_template(
    template_id: str,
    user: CurrentUser = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
) -> None:
    res = (
        supabase.table("prompt_templates")
        .delete()
        .eq("id", template_id)
        .eq("user_id", user.id)
        .execute()
    )
    if not res.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "template not found")
