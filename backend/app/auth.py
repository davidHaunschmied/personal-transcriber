from functools import lru_cache

from fastapi import Depends, Header, HTTPException, status
from supabase import Client, create_client

from app.config import Settings, get_settings


class CurrentUser:
    def __init__(self, user_id: str, email: str | None):
        self.id = user_id
        self.email = email


@lru_cache
def _anon_client(url: str, key: str) -> Client:
    return create_client(url, key)


def get_current_user(
    authorization: str | None = Header(default=None),
    settings: Settings = Depends(get_settings),
) -> CurrentUser:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    try:
        client = _anon_client(settings.supabase_url, settings.supabase_anon_key)
        response = client.auth.get_user(token)
    except Exception as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, f"invalid token: {exc}") from exc
    user = response.user
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid token")
    return CurrentUser(user_id=user.id, email=user.email)
