"""Score one gateway feature packet with the exported fusion model."""
import argparse
import json
import joblib
import pandas as pd


def main():
    parser = argparse.ArgumentParser(description="RockSentinel 6-hour risk scorer")
    parser.add_argument("--input", required=True, help="JSON file containing the required sensor fields")
    args = parser.parse_args()
    artifact = joblib.load("models/risk/rockfall_risk_model.joblib")
    packet = json.loads(open(args.input, encoding="utf-8").read())
    missing = [f for f in artifact["features"] if f not in packet]
    if missing: raise SystemExit(f"Missing sensor fields: {', '.join(missing)}")
    probability = float(artifact["model"].predict_proba(pd.DataFrame([packet])[artifact["features"]])[:, 1][0])
    # The 0-10 score is for dashboard display. Alert policy is deliberately
    # conservative and should be configured and approved per mine.
    score = round(probability * 10, 2)
    if probability >= artifact["threshold"]: tier = "warning_review_required"
    elif probability >= .12: tier = "watch"
    else: tier = "normal"
    print(json.dumps({"risk_probability_next_6h": round(probability, 4), "risk_score_0_to_10": score, "tier": tier, "model": artifact["model_name"]}, indent=2))


if __name__ == "__main__": main()
