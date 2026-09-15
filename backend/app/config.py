from __future__ import annotations
import json
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator


class Settings(BaseSettings):
    # Application
    APP_NAME: str = "GridWise"
    APP_VERSION: str = "1.0.0"
    APP_ENV: str = "development"

    # API
    API_V1_PREFIX: str = "/api/v1"
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:5173"]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors(cls, v: str | list) -> list[str]:
        if isinstance(v, str):
            return json.loads(v)
        return v

    # Data
    DATA_DIR: str = "../data"
    DATA_SOURCE: str = "json"
    RESCORE_ON_STARTUP: bool = True

    # Risk Engine thresholds
    RISK_CRITICAL_THRESHOLD: float = 80.0
    RISK_HIGH_THRESHOLD: float = 60.0
    RISK_MEDIUM_THRESHOLD: float = 40.0
    OUTAGE_HIGH_PROBABILITY_THRESHOLD: float = 0.60
    MAINTENANCE_GAP_ALERT_DAYS: int = 180
    LOAD_ALERT_THRESHOLD_PCT: float = 85.0
    TEMPERATURE_ALERT_THRESHOLD_C: float = 75.0

    # Rate limiting
    RATE_LIMIT_PER_MINUTE: int = 60
    SIMULATOR_RATE_LIMIT_PER_MINUTE: int = 20

    # Logging
    LOG_LEVEL: str = "INFO"

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
        case_sensitive=True,
    )


settings = Settings()
