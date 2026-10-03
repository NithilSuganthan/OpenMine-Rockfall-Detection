# RockSentinel ML Integration Package

## Contents

| Component | File | Purpose |
|---|---|---|
| Sensor fusion | `models/risk/rockfall_risk_model.joblib` | Probability of rockfall within 6 hours from current sensor packet |
| Slow trend | `models/trend/slow_deformation_lstm.pt` | Slow-deformation risk from a 24-step sensor history |
| Vision | `models/vision/crack_severity_yolo.pt` | YOLO26 nano classifier: `normal`, `hairline_crack`, `severe_crack` |
| Consolidation | `src/consolidate_risk.py` | Returns the final score (0–10) and tier |

## Install

Use Python 3.10–3.13. Create a virtual environment, activate it, then run:

```powershell
pip install -r requirements-integration.txt
```

## Sensor-only score

```powershell
python src/predict_risk.py --input data/example_sensor_packet.json
```

The required current-sensor fields are:
`rainfall_24h_mm`, `temperature_c`, `soil_moisture_pct`, `pore_pressure_kpa`, `tilt_rate_deg_hr`, `displacement_rate_mm_hr`, `strain_microstrain`, `vibration_rms_g`, `dominant_frequency_hz`, `crack_width_mm`, `neighbour_consensus`, `blast_window`.

## Final consolidated score

Provide a 24 × 5 JSON array for `--trend-window`, with feature order:
`displacement_mm`, `tilt_deg`, `crack_width_mm`, `pore_pressure_kpa`, `rainfall_mm`.

```powershell
python src/consolidate_risk.py --sensor data/example_sensor_packet.json --trend-window data/example_trend_window.json --vision-severe-confidence 0.82
```

The returned tier is one of `normal`, `watch`, `warning`, or `emergency`.

## Vision inference

```python
from ultralytics import YOLO
model = YOLO("models/vision/crack_severity_yolo.pt")
result = model("camera_frame.jpg")[0]
label = result.names[result.probs.top1]
confidence = float(result.probs.top1conf)
```

Use `confidence` as `--vision-severe-confidence` only when `label == "severe_crack"`; otherwise use `0.0`.

## Important limitation

All reported scores were validated on synthetic data. This package is suitable for the SIH prototype/demo. It must be recalibrated and revalidated on labelled site data before operational safety use.
