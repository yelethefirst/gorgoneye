"""Exports the trained XGBoost classifier to ONNX and verifies parity.

The parity check loads both the original model and the ONNX model, runs them
on a deterministic sample of feature vectors from the training set, and
asserts probabilities agree to within 1e-5. If they don't, the export is
unsound and the script fails.

Outputs:
  artifacts/phishing-classifier.onnx
  ../public/models/phishing-classifier.onnx  (copy for the browser)
  artifacts/onnx_parity.json
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

import joblib
import numpy as np
import onnxruntime as ort
import pandas as pd
from onnxmltools.convert import convert_xgboost
from onnxmltools.convert.common.data_types import FloatTensorType

from features import FEATURE_NAMES, extract_features_by_name

ROOT = Path(__file__).resolve().parent
ARTIFACTS = ROOT / "artifacts"
PUBLIC_MODEL = ROOT.parent / "public" / "models" / "phishing-classifier.onnx"

PARITY_TOLERANCE = 1e-5


def export(args: argparse.Namespace) -> None:
    booster = joblib.load(args.model)

    initial_type = [("input", FloatTensorType([None, len(FEATURE_NAMES)]))]
    onnx_model = convert_xgboost(booster, initial_types=initial_type, target_opset=15)

    out_path = ARTIFACTS / "phishing-classifier.onnx"
    with out_path.open("wb") as fh:
        fh.write(onnx_model.SerializeToString())

    # Parity check.
    df = pd.read_parquet(args.dataset)
    sample = df.sample(n=min(50, len(df)), random_state=20260601)
    X = np.array(
        [
            [extract_features_by_name(u)[name] for name in FEATURE_NAMES]
            for u in sample["url"].astype(str)
        ],
        dtype=np.float32,
    )

    original_probs = booster.predict_proba(X)[:, 1]
    session = ort.InferenceSession(str(out_path), providers=["CPUExecutionProvider"])
    onnx_out = session.run(None, {"input": X})
    # XGBClassifier ONNX output schema: [label, probability_dict_or_tensor]
    onnx_probs_struct = onnx_out[1]
    if isinstance(onnx_probs_struct, list) and isinstance(onnx_probs_struct[0], dict):
        # Dict-of-tensor mapping per row.
        onnx_probs = np.array([row[1] for row in onnx_probs_struct], dtype=np.float32)
    else:
        # Tensor [N, 2] — take the phishing-positive column.
        onnx_probs = np.asarray(onnx_probs_struct, dtype=np.float32)[:, 1]

    diffs = np.abs(onnx_probs - original_probs)
    max_diff = float(diffs.max())
    mean_diff = float(diffs.mean())

    parity_report = {
        "model": str(out_path),
        "n_samples": int(len(X)),
        "max_abs_diff": max_diff,
        "mean_abs_diff": mean_diff,
        "tolerance": PARITY_TOLERANCE,
        "passed": bool(max_diff < PARITY_TOLERANCE),
    }
    (ARTIFACTS / "onnx_parity.json").write_text(json.dumps(parity_report, indent=2))

    print(
        f"export_onnx: max_diff={max_diff:.2e} mean_diff={mean_diff:.2e} "
        f"(tolerance={PARITY_TOLERANCE:.0e}) -> "
        f"{'OK' if parity_report['passed'] else 'FAIL'}"
    )
    if not parity_report["passed"]:
        raise SystemExit("ONNX round-trip diverges from the original model.")

    PUBLIC_MODEL.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(out_path, PUBLIC_MODEL)
    size_kb = out_path.stat().st_size / 1024
    print(f"export_onnx: wrote {size_kb:.1f} KB -> {PUBLIC_MODEL}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Export trained model to ONNX")
    parser.add_argument(
        "--model", default=str(ARTIFACTS / "model.joblib"), help="Trained model joblib"
    )
    parser.add_argument(
        "--dataset",
        default=str(ARTIFACTS / "dataset.parquet"),
        help="Source dataset for parity sample",
    )
    args = parser.parse_args(argv)
    export(args)
    return 0


if __name__ == "__main__":
    sys.exit(main())
