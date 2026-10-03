"""Environment-driven configuration for the RockSafe backend.

All values can be overridden via environment variables (prefix ROCKSAFE_) or a
.env file placed next to the backend folder.
"""
import os
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings:
    app_name: str = "RockSafe Digital Twin API"

    # SQLite by default (zero-config local dev); set ROCKSAFE_DATABASE_URL to a
    # postgresql:// URL to use the PostgreSQL stack in production/Docker.
    database_url: str = os.environ.get("ROCKSAFE_DATABASE_URL", f"sqlite:///{BACKEND_DIR / 'rocksafe.db'}")

    # Optional MQTT publisher. Leave empty to disable.
    mqtt_url: str = os.environ.get("ROCKSAFE_MQTT_URL", "")
    mqtt_topic: str = os.environ.get("ROCKSAFE_MQTT_TOPIC", "rocksentinel/predictions")

    model_dir: Path = BACKEND_DIR / "app" / "ml" / "models"

    cors_origins: list[str] = [
        o.strip()
        for o in os.environ.get("ROCKSAFE_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
        if o.strip()
    ]


settings = Settings()
