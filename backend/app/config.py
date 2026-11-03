"""Application configuration, 2026-27 MSP benchmarks, and spatial/HAL constants."""

from functools import lru_cache
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    APP_NAME: str = "KapasSetu AI"
    APP_VERSION: str = "1.0.0"
    APP_ENV: str = "development"

    # Database: PostGIS primary with instant SQLite + Haversine fallback
    USE_SQLITE_FALLBACK: bool = True
    SQLITE_URL: str = f"sqlite:///{(BASE_DIR / 'kapassetu.db').as_posix()}"
    DATABASE_URL: str = "postgresql://kapassetu:kapassetu_pass@localhost:5432/kapassetu_db"
    REDIS_URL: str = "redis://localhost:6379/0"

    # Weather Telemetry (Open-Meteo)
    OPEN_METEO_BASE_URL: str = "https://api.open-meteo.com/v1/forecast"
    OPEN_METEO_TIMEOUT_SEC: float = 2.0
    DEFAULT_FALLBACK_RH_PCT: float = 55.0
    DEFAULT_FALLBACK_TEMP_C: float = 32.0

    # 2026-27 Indian Cotton MSP & eNAM Mandi Benchmarks (INR / Quintal)
    MSP_MEDIUM_STAPLE_INR: float = 7121.0
    MSP_LONG_STAPLE_INR: float = 7521.0
    ENAM_CEILING_LONG_STAPLE_INR: float = 8667.0
    LONG_STAPLE_THRESHOLD_MM: float = 27.5
    MEDIUM_STAPLE_BASELINE_MM: float = 26.0
    TRASH_BENCHMARK_PCT: float = 3.0
    MOISTURE_BENCHMARK_PCT: float = 8.0

    # Geo-Clustered Village Lot Aggregation
    VILLAGE_POOL_RADIUS_KM: float = 5.0
    VILLAGE_POOL_RADIUS_METERS: float = 5000.0
    GINNER_NOTIFICATION_RADIUS_KM: float = 50.0
    DEFAULT_POOL_THRESHOLD_QUINTALS: float = 30.0

    # Edge Lint Inspection & Hardware Abstraction Layer (HAL)
    ONNX_MODEL_PATH: str = str(BASE_DIR / "models" / "cotton_contaminant_yolov8n.onnx")
    HAL_CONFIDENCE_THRESHOLD: float = 0.70
    HAL_DEFAULT_RELAY_DURATION_MS: int = 5000
    EXTERNAL_PLC_WEBHOOK_URL: str = ""

    # CORS
    CORS_ORIGINS: str = "*"

    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def effective_database_url(self) -> str:
        if self.USE_SQLITE_FALLBACK:
            return self.SQLITE_URL
        return self.DATABASE_URL


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

