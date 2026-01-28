from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    """
    Application settings managed by Pydantic.
    Reads from environment variables or uses defaults.
    """
    PROJECT_NAME: str = "AI Transport Ops"
    API_V1_STR: str = "/api/v1"
    
    # Database settings
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "password"
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_PORT: str = "5432"
    POSTGRES_DB: str = "transport_ops"

    # AI Settings
    JANUS_MODEL_NAME: str = "deepseek-janus-pro-7b"  # Default to what user wants
    OLLAMA_BASE_URL: str = "http://host.docker.internal:11434"
    AI_PROVIDER: str = "ollama"
    
    @property
    def DATABASE_URL(self) -> str:
        # Construct the async PostgreSQL connection string
        return f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    model_config = SettingsConfigDict(env_file=".env")

settings = Settings()
