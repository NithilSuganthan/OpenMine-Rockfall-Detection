"""Request/response models for the prediction endpoint."""
from typing import Any

from pydantic import BaseModel, Field


class PredictRequest(BaseModel):
    sensor_packet: dict[str, Any] = Field(description="12-field gateway sensor packet")
    trend_window: list[list[float]] = Field(description="24x5 array: displacement_mm, tilt_deg, crack_width_mm, pore_pressure_kpa, rainfall_mm")
    image: str | None = Field(default=None, description="Optional base64-encoded camera frame (JPEG/PNG)")
    image_filename: str | None = Field(default=None)


class PredictResponse(BaseModel):
    score: float = Field(description="Consolidated risk score, 0-10")
    tier: str = Field(description="normal | watch | warning | emergency")
    confidence: float = Field(description="0-1 weighted confidence")
    recommendation: str
