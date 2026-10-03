"""XGBoost fusion model loader.

The scoring math itself lives in `app.ml.consolidate.consolidate_risk` (the
original RockSentinel package) — this module only loads the artifact once so
the service can reuse it across requests.
"""
from pathlib import Path

import joblib


def load_fusion(path: Path) -> dict:
    """Load the rockfall fusion artifact (model, features, threshold)."""
    return joblib.load(path)
