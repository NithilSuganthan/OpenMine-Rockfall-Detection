"""Combine instant rules, fusion probability, visual severity and LSTM trend score.

Original RockSentinel package module, adapted for reuse inside the backend:
- `consolidate()` accepts already-loaded models so inference reuses them.
- The CLI (`main`) keeps the original behaviour and loads the models itself.
"""
import argparse
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import torch

try:
    from .train_trend_lstm import TrendLSTM
except ImportError:  # executed as a plain script (python consolidate_risk.py ...)
    from train_trend_lstm import TrendLSTM

MODELS = Path(__file__).resolve().parents[2] / "models"


def consolidate(sensor, trend_window, vision_severe_confidence=0.0, *, fusion, lstm_state):
    """Final consolidated risk from the three signals.

    - fusion: joblib artifact dict {model, features, threshold, model_name}
    - lstm_state: dict from app.ml.trend.lstm.load_trend {model, mean, std}
    """
    sensor_p = float(
        fusion["model"].predict_proba(pd.DataFrame([sensor])[fusion["features"]])[:, 1][0]
    )
    trend = np.asarray(trend_window, dtype=np.float32)
    if trend.shape != (24, 5):
        raise ValueError("trend window must be exactly 24x5")
    with torch.no_grad():
        trend_p = float(
            torch.sigmoid(
                lstm_state["model"](
                    torch.tensor(((trend - lstm_state["mean"]) / lstm_state["std"])[None])
                )
            )[0]
        )
    instant_critical = sensor["tilt_rate_deg_hr"] >= 0.9 or (
        sensor["vibration_rms_g"] >= 1.2 and not sensor["blast_window"]
    )
    weighted = min(1.0, 0.45 * sensor_p + 0.30 * trend_p + 0.25 * vision_severe_confidence)
    risk = max(weighted, 0.91) if instant_critical else weighted
    tier = "emergency" if risk >= 0.91 else "warning" if risk >= 0.71 else "watch" if risk >= 0.41 else "normal"
    return {
        "risk_score_0_to_10": round(risk * 10, 2),
        "tier": tier,
        "confidence": round(weighted, 4),
        "inputs": {
            "instant_critical": instant_critical,
            "fusion_probability": round(sensor_p, 4),
            "trend_probability": round(trend_p, 4),
            "vision_severe_confidence": vision_severe_confidence,
        },
    }


def main():
    parser = argparse.ArgumentParser(description="RockSentinel consolidated risk scorer")
    parser.add_argument("--sensor", required=True)
    parser.add_argument("--trend-window", required=True, help="JSON 24x5 array in documented feature order")
    parser.add_argument("--vision-severe-confidence", type=float, default=0.0)
    args = parser.parse_args()
    sensor = json.loads(open(args.sensor, encoding="utf-8").read())
    fusion = joblib.load(MODELS / "risk" / "rockfall_risk_model.joblib")
    ckpt = torch.load(MODELS / "trend" / "slow_deformation_lstm.pt", map_location="cpu", weights_only=False)
    lstm = TrendLSTM()
    lstm.load_state_dict(ckpt["state_dict"])
    lstm.eval()
    result = consolidate(
        sensor,
        json.loads(open(args.trend_window, encoding="utf-8").read()),
        args.vision_severe_confidence,
        fusion=fusion,
        lstm_state={"model": lstm, "mean": ckpt["mean"], "std": ckpt["std"]},
    )
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
