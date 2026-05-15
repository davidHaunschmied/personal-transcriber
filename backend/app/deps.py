from functools import lru_cache

from fastapi import Depends
from supabase import Client, create_client

from app.config import Settings, get_settings


@lru_cache
def _service_client_cached(url: str, key: str) -> Client:
    return create_client(url, key)


def get_supabase(settings: Settings = Depends(get_settings)) -> Client:
    """Service-role Supabase client. Bypasses RLS — callers must enforce ownership."""
    return _service_client_cached(settings.supabase_url, settings.supabase_service_role_key)
