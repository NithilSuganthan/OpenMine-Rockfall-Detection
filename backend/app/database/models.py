"""Database tables. Only the prediction store is added; existing data is untouched."""
from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from .session import Base


class Prediction(Base):
    __tablename__ = "predictions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    score: Mapped[float] = mapped_column(Float)
    tier: Mapped[str] = mapped_column(String(32))
    confidence: Mapped[float] = mapped_column(Float)
    recommendation: Mapped[str] = mapped_column(String(512))
    sensor_packet: Mapped[dict] = mapped_column(JSON)
    trend_window: Mapped[list] = mapped_column(JSON)
    vision_label: Mapped[str | None] = mapped_column(String(32), nullable=True)
    vision_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
