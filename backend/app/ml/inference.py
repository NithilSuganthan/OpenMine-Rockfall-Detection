"""PredictionService — the single inference entry point.

Models are loaded once at application startup and reused for every request.
All scoring logic is delegated to the original RockSentinel package modules:
- app.ml.risk.fusion.load_fusion        (XGBoost fusion artifact)
- app.ml.trend.lstm.load_trend          (LSTM checkpoint)
- app.ml.vision.yolo_cls.VisionClassifier (lazy YOLO classifier)
- app.ml.consolidate.consolidate_risk.consolidate (single source of truth for scoring)
"""
import base64
from pathlib import Path

from .consolidate.consolidate_risk import consolidate
from .risk.fusion import load_fusion
from .trend.lstm import load_trend
from .vision.yolo_cls import VisionClassifier

RECOMMENDATIONS: dict[str, str] = {
    "emergency": "Site lockdown — evacuate personnel, halt blasting and mobilise the response team immediately.",
    "warning": "Reinforce the exclusion zone, restrict operations near the affected face and double the monitoring cadence.",
    "watch": "Increase camera and sensor inspection frequency and pre-stage contingency resources.",
    "normal": "No action required — maintain the standard monitoring schedule.",
}


class PredictionError(ValueError):
    pass


class PredictionService:
    def __init__(self, model_dir: Path) -> None:
        self.model_dir = Path(model_dir)
        self._fusion = None
        self._trend_state = None
        self._vision: VisionClassifier | None = None

    def start(self) -> None:
        """Load the sensor models once at application startup."""
        self._fusion = load_fusion(self.model_dir / "risk" / "rockfall_risk_model.joblib")
        self._trend_state = load_trend(self.model_dir / "trend" / "slow_deformation_lstm.pt")

    def _vision_model(self) -> VisionClassifier:
        if self._vision is None:
            self._vision = VisionClassifier(self.model_dir / "vision" / "crack_severity_yolo.pt")
        return self._vision

    def predict(
        self,
        sensor_packet: dict,
        trend_window: list[list[float]],
        image_base64: str | None = None,
    ) -> dict:
        """Run consolidation and return {risk_score_0_to_10, tier, confidence,
        recommendation, vision_label, inputs}."""
        vision_label = None
        vision_confidence = 0.0
        if image_base64:
            try:
                image_bytes = base64.b64decode(image_base64)
            except Exception as exc:
                raise PredictionError("image must be base64-encoded data") from exc
            try:
                vision_label, vision_confidence = self._vision_model().classify(image_bytes)
            except Exception as exc:
                raise PredictionError(f"camera frame could not be processed: {exc}") from exc
            if vision_label != "severe_crack":
                vision_confidence = 0.0

        result = consolidate(
            sensor_packet,
            trend_window,
            vision_confidence,
            fusion=self._fusion,
            lstm_state=self._trend_state,
        )
        result["recommendation"] = RECOMMENDATIONS[result["tier"]]
        result["vision_label"] = vision_label
        return result
