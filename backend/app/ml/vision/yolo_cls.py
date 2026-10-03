"""Crack-severity vision classifier (YOLO26 nano classifier).

Ultralytics/torchvision are heavy imports, so the model is loaded lazily on
the first camera frame and reused afterwards.
"""
from pathlib import Path


class VisionClassifier:
    def __init__(self, path: Path) -> None:
        self.path = path
        self._model = None

    def _ensure(self):
        if self._model is None:
            from ultralytics import YOLO

            self._model = YOLO(str(self.path))
        return self._model

    def classify(self, image_bytes: bytes) -> tuple[str, float]:
        """Return (label, confidence). Labels: normal, hairline_crack, severe_crack."""
        from io import BytesIO

        from PIL import Image

        image = Image.open(BytesIO(image_bytes)).convert("RGB")
        result = self._ensure()(image)[0]
        label = self._model.names[result.probs.top1]
        confidence = float(result.probs.top1conf)
        return label, confidence
