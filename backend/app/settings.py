from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List

class Settings(BaseSettings):
    DATABASE_URL: str
    CORS_ORIGIN: str | None = None
    USE_CATALOG_MAT: int = 0
    MIGRATIONS_DIR: str = "sql"  # relative to project root

    model_config = SettingsConfigDict(env_file=".env", env_prefix="")

    def cors_origins(self) -> List[str]:
        # With allow_credentials=True, using wildcard "*" is problematic for browsers.
        # Default to local frontend origins for development.
        if not self.CORS_ORIGIN:
            return [
                "http://localhost:5173",
                "http://127.0.0.1:5173",
            ]
        return [o.strip().rstrip("/") for o in self.CORS_ORIGIN.split(",") if o.strip()]

settings = Settings()
