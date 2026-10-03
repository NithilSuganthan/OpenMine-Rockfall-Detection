"""Combine instant rules, fusion probability, visual severity and LSTM trend score."""
import argparse, json, joblib
import numpy as np
import pandas as pd
import torch
from train_trend_lstm import TrendLSTM


def main():
    p = argparse.ArgumentParser(); p.add_argument("--sensor", required=True); p.add_argument("--trend-window", required=True, help="JSON 24x5 array in documented feature order"); p.add_argument("--vision-severe-confidence", type=float, default=0.0); args = p.parse_args()
    sensor = json.loads(open(args.sensor, encoding="utf-8").read())
    fusion = joblib.load("models/risk/rockfall_risk_model.joblib")
    sensor_p = float(fusion["model"].predict_proba(pd.DataFrame([sensor])[fusion["features"]])[:, 1][0])
    ckpt = torch.load("models/trend/slow_deformation_lstm.pt", map_location="cpu", weights_only=False)
    trend = np.asarray(json.loads(open(args.trend_window, encoding="utf-8").read()), dtype=np.float32)
    if trend.shape != (24, 5): raise SystemExit("trend window must be exactly 24x5")
    lstm = TrendLSTM(); lstm.load_state_dict(ckpt["state_dict"]); lstm.eval()
    with torch.no_grad(): trend_p = float(torch.sigmoid(lstm(torch.tensor(((trend-ckpt["mean"])/ckpt["std"])[None])))[0])
    instant_critical = sensor["tilt_rate_deg_hr"] >= .9 or (sensor["vibration_rms_g"] >= 1.2 and not sensor["blast_window"])
    risk = min(1., .45*sensor_p + .30*trend_p + .25*args.vision_severe_confidence)
    if instant_critical: risk = max(risk, .91)
    tier = "emergency" if risk >= .91 else "warning" if risk >= .71 else "watch" if risk >= .41 else "normal"
    print(json.dumps({"risk_score_0_to_10": round(risk*10,2), "tier":tier, "inputs":{"instant_critical":instant_critical,"fusion_probability":round(sensor_p,4),"trend_probability":round(trend_p,4),"vision_severe_confidence":args.vision_severe_confidence}}, indent=2))

if __name__ == "__main__": main()
