"""Slow-deformation LSTM loader.

The TrendLSTM class comes from the original package (train_trend_lstm.py) —
no re-implementation. The checkpoint holds state_dict + per-feature
mean/std used for standardisation.
"""
from pathlib import Path

import torch

from ..consolidate.train_trend_lstm import TrendLSTM


def load_trend(path: Path) -> dict:
    """Load the LSTM checkpoint once and return a ready-to-use state bundle."""
    ckpt = torch.load(path, map_location="cpu", weights_only=False)
    model = TrendLSTM()
    model.load_state_dict(ckpt["state_dict"])
    model.eval()
    return {
        "model": model,
        "mean": ckpt["mean"],
        "std": ckpt["std"],
        "features": ckpt.get("features"),
        "threshold": ckpt.get("threshold"),
    }
