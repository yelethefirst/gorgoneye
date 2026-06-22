# Python training pipeline (Epic 3)

This directory holds the offline part of Gorgon Eye's local ML classifier
(Layer 2). Browser-side feature extraction lives in
[`src/ml/features.ts`](../src/ml/features.ts); this is its mirror image.

The pipeline is structured so each step can be run independently:

1. **`build_dataset.py`** — merges PhishTank / OpenPhish / Tranco URL lists
   into a single deduplicated CSV. Ships with a small synthetic dataset
   (`sample_dataset.csv`) so the full pipeline runs end-to-end without any
   external downloads — useful for CI and smoke tests.
2. **`features.py`** — Python feature extractor. Must produce identical
   output to the TypeScript extractor; the contract is
   [`FEATURES.md`](./FEATURES.md) plus the frozen JSON snapshot at
   `tests/ml/__snapshots__/featureParity.json`.
3. **`parity_check.py`** — runs the Python extractor over the frozen
   snapshot URLs and fails if any feature drifts. Run this **first** when
   editing features on either side.
4. **`train.py`** — XGBoost training with a stratified split and a metrics
   report (`artifacts/metrics.json`, `artifacts/confusion_matrix.csv`).
5. **`export_onnx.py`** — exports the trained booster to ONNX, runs a
   round-trip parity check between the original model and the ONNX
   prediction, and copies the model to `../public/models/phishing-classifier.onnx`
   (excluded from git; released through a separate workflow).

## Quick start

```bash
cd training
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# 0. Parity check (no downloads required)
python parity_check.py

# 1. Build dataset (or use the synthetic one)
python build_dataset.py --use-sample

# 2. Train
python train.py --input artifacts/dataset.parquet

# 3. Export to ONNX
python export_onnx.py --model artifacts/model.joblib
```

`run_pipeline.sh` does all of the above sequentially against the synthetic
dataset and is what CI runs.

## Adding a new feature

Any feature change is a release contract update. The procedure is:

1. Edit [`features.py`](./features.py) here.
2. Edit [`src/ml/features.ts`](../src/ml/features.ts) on the TypeScript side.
3. Edit [`src/ml/featureSchema.ts`](../src/ml/featureSchema.ts) (`FEATURE_NAMES`
   and `FEATURE_SCHEMA_VERSION`).
4. Edit [`FEATURES.md`](./FEATURES.md).
5. Regenerate the snapshot:
   ```bash
   pnpm test tests/ml/features.parity.test.ts -u  # regenerate JSON
   python parity_check.py                          # verify Python matches
   ```

If either side fails parity, **do not** mutate the snapshot. Investigate
which implementation drifted.

## What is NOT committed

- Real phishing URLs and any vendor datasets (PhishTank / OpenPhish / Tranco
  copies). These often carry licensing constraints. Keep them under
  `training/raw/` which is gitignored.
- Trained models. ONNX binaries go through a separate signed-release flow.
- Anything containing real victim data or email content.
