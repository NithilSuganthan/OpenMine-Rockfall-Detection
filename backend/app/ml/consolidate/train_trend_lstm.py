"""Train an LSTM on synthetic multi-sensor time windows for slow deformation."""
from pathlib import Path
import json
import numpy as np
import torch
from torch import nn

OUT = Path("models/trend")
RNG = np.random.default_rng(25071)


class TrendLSTM(nn.Module):
    def __init__(self):
        super().__init__()
        self.lstm = nn.LSTM(input_size=5, hidden_size=32, num_layers=2, batch_first=True, dropout=.15)
        self.head = nn.Sequential(nn.Linear(32, 16), nn.ReLU(), nn.Dropout(.1), nn.Linear(16, 1))
    def forward(self, x): return self.head(self.lstm(x)[0][:, -1]).squeeze(1)


def make_data(n=1800, t=24):
    x = np.zeros((n, t, 5), np.float32); y = np.zeros(n, np.float32); groups = np.arange(n) % 30
    for i in range(n):
        instability = RNG.normal() + (groups[i] % 7 == 0) * .35
        rain = RNG.gamma(1.6, 3.5, t)
        creep = max(0, .05 + .16 * instability + .006 * rain.mean())
        time = np.arange(t)
        displacement = .3 + creep * time + RNG.normal(0, .10, t)
        tilt = .08 + creep*.23*time + RNG.normal(0, .04, t)
        crack = .15 + creep*.42*time + RNG.normal(0, .06, t)
        pore = 28 + 8*instability + .7*rain + RNG.normal(0, 2.5, t)
        x[i] = np.c_[displacement, tilt, crack, pore, rain]
        # Target is six hours after the sequence, based on an accelerating trend.
        p = 1/(1+np.exp(-(-3.8 + 10*creep + .018*pore[-1] + .08*rain[-6:].sum())))
        y[i] = RNG.binomial(1, p)
    return x, y, groups


def main():
    torch.manual_seed(25071); torch.set_num_threads(4)
    x, y, groups = make_data()
    test = np.isin(groups, [2, 9, 16, 23, 29]); train = ~test
    mean, std = x[train].mean((0,1)), x[train].std((0,1)) + 1e-6
    x = (x - mean) / std
    xt, yt = torch.tensor(x[train]), torch.tensor(y[train]); xv, yv = torch.tensor(x[test]), torch.tensor(y[test])
    model = TrendLSTM(); opt = torch.optim.AdamW(model.parameters(), lr=2e-3, weight_decay=1e-4)
    pos_weight = torch.tensor([(len(yt)-yt.sum()) / yt.sum()])
    loss_fn = nn.BCEWithLogitsLoss(pos_weight=pos_weight)
    for _ in range(25):
        idx = torch.randperm(len(xt))
        for batch in idx.split(64):
            opt.zero_grad(); loss = loss_fn(model(xt[batch]), yt[batch]); loss.backward(); opt.step()
    with torch.no_grad(): p = torch.sigmoid(model(xv)).numpy()
    # choose safety-first threshold with >=95% recall where possible
    best = (0., 0., .5)
    for threshold in np.linspace(.02, .98, 97):
        pred = p >= threshold; recall = pred[yv.numpy()==1].mean(); precision = yv.numpy()[pred].mean() if pred.any() else 0
        if recall >= .95 and precision > best[0]: best = (float(precision), float(recall), float(threshold))
    OUT.mkdir(parents=True, exist_ok=True)
    torch.save({"state_dict": model.state_dict(), "mean": mean, "std": std, "features": ["displacement_mm", "tilt_deg", "crack_width_mm", "pore_pressure_kpa", "rainfall_mm"], "threshold": best[2]}, OUT / "slow_deformation_lstm.pt")
    metrics = {"validation": "held-out zones", "samples_train": int(train.sum()), "samples_test": int(test.sum()), "synthetic_event_rate_test": float(y[test].mean()), "precision_at_safety_threshold": best[0], "recall_at_safety_threshold": best[1], "threshold": best[2], "limitation": "Synthetic-data validation only; calibrate on site histories."}
    (OUT / "metrics.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    print(json.dumps(metrics, indent=2))


if __name__ == "__main__": main()
