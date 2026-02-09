from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import AnyHttpUrl
from typing import List

class Settings(BaseSettings):
    DATABASE_URL: str
    CORS_ORIGIN: str | None = None
    USE_CATALOG_MAT: int = 0
    MIGRATIONS_DIR: str = "sql"  # relative to project root

    model_config = SettingsConfigDict(env_file=".env", env_prefix="")

    def cors_origins(self) -> List[str] | ["*"]:
        if not self.CORS_ORIGIN:
            return ["*"]
        return [o.strip() for o in self.CORS_ORIGIN.split(",") if o.strip()]

settings = Settings()
