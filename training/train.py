"""Trains an XGBoost phishing classifier from the prepared dataset.

Inputs:
  --input PATH      Parquet produced by build_dataset.py (default
                    artifacts/dataset.parquet)
  --test-size F     Stratified hold-out fraction (default 0.2)
  --max-depth N     XGBoost max_depth (default 4)
  --n-estimators N  Number of trees (default 100)
  --seed N          RNG seed (default 20260601)

Outputs (under artifacts/):
  model.joblib            Trained sklearn pipeline (booster + scaler)
  metrics.json            Top-level metrics (AUROC, PR-AUC, accuracy, F1)
  confusion_matrix.csv    Confusion matrix on the hold-out set
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import (
    average_precision_score,
    classification_report,
    confusion_matrix,
    f1_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from xgboost import XGBClassifier

from features import FEATURE_NAMES, extract_features_by_name

ROOT = Path(__file__).resolve().parent
ARTIFACTS = ROOT / "artifacts"


def featurise(df: pd.DataFrame) -> tuple[np.ndarray, np.ndarray]:
    rows = [extract_features_by_name(u) for u in df["url"].astype(str)]
    X = np.array([[r[name] for name in FEATURE_NAMES] for r in rows], dtype=np.float32)
    y = df["is_phishing"].astype(int).values
    return X, y


def train(args: argparse.Namespace) -> None:
    df = pd.read_parquet(args.input)
    X, y = featurise(df)

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=args.test_size,
        random_state=args.seed,
        stratify=y,
    )

    clf = XGBClassifier(
        n_estimators=args.n_estimators,
        max_depth=args.max_depth,
        learning_rate=0.1,
        random_state=args.seed,
        eval_metric="logloss",
        tree_method="hist",
    )
    clf.fit(X_train, y_train)

    probs = clf.predict_proba(X_test)[:, 1]
    preds = (probs >= 0.5).astype(int)

    metrics = {
        "n_train": int(len(X_train)),
        "n_test": int(len(X_test)),
        "auroc": float(roc_auc_score(y_test, probs)),
        "pr_auc": float(average_precision_score(y_test, probs)),
        "f1": float(f1_score(y_test, preds)),
        "report": classification_report(y_test, preds, output_dict=True),
        "feature_names": FEATURE_NAMES,
        "model": {
            "type": "xgboost",
            "n_estimators": args.n_estimators,
            "max_depth": args.max_depth,
        },
    }

    ARTIFACTS.mkdir(exist_ok=True)
    joblib.dump(clf, ARTIFACTS / "model.joblib")
    (ARTIFACTS / "metrics.json").write_text(json.dumps(metrics, indent=2))

    cm = confusion_matrix(y_test, preds)
    cm_df = pd.DataFrame(
        cm, index=["actual_benign", "actual_phishing"], columns=["pred_benign", "pred_phishing"]
    )
    cm_df.to_csv(ARTIFACTS / "confusion_matrix.csv")

    print(
        f"train: AUROC={metrics['auroc']:.3f} PR-AUC={metrics['pr_auc']:.3f} "
        f"F1={metrics['f1']:.3f} (n_test={metrics['n_test']})"
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Train XGBoost phishing classifier")
    parser.add_argument(
        "--input", default=str(ARTIFACTS / "dataset.parquet"), help="Parquet dataset"
    )
    parser.add_argument("--test-size", type=float, default=0.2)
    parser.add_argument("--max-depth", type=int, default=4)
    parser.add_argument("--n-estimators", type=int, default=100)
    parser.add_argument("--seed", type=int, default=20260601)
    args = parser.parse_args(argv)
    train(args)
    return 0


if __name__ == "__main__":
    sys.exit(main())
