#!/usr/bin/env bash
# Runs the full Python training pipeline end-to-end against the synthetic
# sample dataset. Used by CI; also a useful local smoke test.
set -euo pipefail

cd "$(dirname "$0")"

echo "[1/4] parity_check.py"
python3 parity_check.py

echo "[2/4] build_dataset.py --use-sample"
python3 build_dataset.py --use-sample

echo "[3/4] train.py"
python3 train.py

echo "[4/4] export_onnx.py"
python3 export_onnx.py

echo "OK — pipeline ran cleanly. Artifacts under training/artifacts/."
