from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str
    supabase_jwt_secret: str

    groq_api_key: str
    anthropic_api_key: str

    cors_origins: str = "http://localhost:3000"

    default_transformation_model: str = "claude-sonnet-4-6"
    whisper_model: str = "whisper-large-v3"
    max_audio_bytes: int = 25 * 1024 * 1024
    recordings_bucket: str = "recordings"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
