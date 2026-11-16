from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Astrid Downloader"
    environment: str = Field(default="development", alias="ENVIRONMENT")
    api_v1_prefix: str = "/api/v1"
    supabase_url: str = Field(default="", alias="SUPABASE_URL")
    supabase_anon_key: str = Field(default="", alias="SUPABASE_ANON_KEY")
    supabase_service_role_key: str = Field(default="", alias="SUPABASE_SERVICE_ROLE_KEY")
    database_url: str = Field(default="", alias="DATABASE_URL")
    use_local_db: bool = Field(default=False, alias="USE_LOCAL_DB")
    supabase_jwt_secret: str = Field(default="", alias="SUPABASE_JWT_SECRET")
    secret_key: str = Field(default="development-secret-key", alias="SECRET_KEY")
    frontend_url: str = Field(default="http://localhost:5173", alias="FRONTEND_URL")
    storage_path: str = Field(default="./storage", alias="STORAGE_PATH")
    storage_quota_bytes: int = Field(default=0, alias="STORAGE_QUOTA_BYTES", ge=0)
    download_max_retries: int = Field(default=2, alias="DOWNLOAD_MAX_RETRIES", ge=0)
    download_retry_backoff_seconds: float = Field(
        default=1.0, alias="DOWNLOAD_RETRY_BACKOFF_SECONDS", ge=0
    )
    max_rate_requests_per_minute: int = Field(
        default=120, alias="MAX_RATE_REQUESTS_PER_MINUTE", ge=1
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
