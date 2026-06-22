# ML Training And Model Release Guide

## Goal

Train a phishing URL classifier offline, export it to ONNX, and run it locally in the browser without sending URLs or features to a server.

## Training Inputs

Phishing sources:

- PhishTank verified phishing URLs.
- OpenPhish feed.
- Internal sanitized fixtures for repeatable tests.

Legitimate sources:

- Tranco top domains converted to representative URLs.
- Curated legitimate login URLs for major brands.
- Internal allowlist fixtures.

Do not commit raw third-party datasets unless their licenses explicitly allow redistribution.

## Dataset Schema

```csv
url,is_phishing,source,observed_at
https://example.com,0,tranco,2026-05-26T00:00:00Z
https://example.test/login,1,fixture,2026-05-26T00:00:00Z
```

Rules:

- Normalize duplicate URLs.
- Remove exact duplicates.
- Keep source labels.
- Keep class balance close to 50/50 for initial training.
- Maintain a separate fixture test set that is never used for training.

## Feature Schema

`training/FEATURES.md` must define each feature:

- Name.
- Type.
- Range.
- Description.
- Python implementation notes.
- TypeScript implementation notes.

Required feature groups:

- Lengths: URL, hostname, path, query.
- Counts: dots, hyphens, digits, symbols, percent-encoded sequences.
- Ratios: digit ratio, symbol ratio.
- Entropy: hostname entropy and path entropy.
- Domain structure: subdomain count, public suffix, registrable domain length.
- Security indicators: HTTPS flag, IP host flag, punycode flag.
- Phishing language: credential keyword counts.
- Redirect indicators: URL-in-URL flag, suspicious query parameter names.
- Brand distance: minimum edit distance to protected brand list.

## Python Pipeline

Expected files:

```text
training/
  build_dataset.py
  features.py
  train.py
  evaluate.py
  export_onnx.py
  FEATURES.md
  artifacts/
```

Commands:

```bash
python -m venv .venv
source .venv/bin/activate
pip install pandas scikit-learn xgboost onnxmltools skl2onnx pyarrow matplotlib
python training/build_dataset.py
python training/train.py
python training/evaluate.py
python training/export_onnx.py
```

## Evaluation Requirements

Save:

- Accuracy.
- Precision.
- Recall.
- F1.
- ROC-AUC.
- Confusion matrix.
- Dataset version.
- Feature schema version.
- Model version.

Targets for demo:

- Accuracy at or above 95 percent on a held-out test set.
- False-positive rate under 0.5 percent on a curated legitimate set.
- Inference under 200 ms in browser worker on demo hardware.

These are targets, not claims. Do not put metrics in the pitch until measured.

## ONNX Export Requirements

The exported file should be:

```text
public/models/phishing-classifier.onnx
```

Release metadata:

```json
{
  "modelVersion": "2026.05.26-001",
  "featureSchemaVersion": "url-features-v1",
  "trainingDatasetVersion": "dataset-v1",
  "sha256": "replace_with_artifact_hash",
  "createdAt": "2026-05-26T00:00:00Z",
  "metrics": {
    "accuracy": 0.0,
    "precision": 0.0,
    "recall": 0.0,
    "f1": 0.0,
    "rocAuc": 0.0
  }
}
```

## Feature Parity Tests

Create a fixture file:

```text
tests/fixtures/ml-feature-parity.json
```

Each row should contain:

- URL.
- Python feature array.
- Expected named features.

TypeScript tests must:

- Load the fixture.
- Run `extractFeatures(url)`.
- Assert identical length and order.
- Assert values match exactly where possible or within tolerance for floating point values.

## Model Loading In Browser

Worker behavior:

- Lazy load ONNX model on first request.
- Cache inference session.
- Verify model metadata hash if available.
- Return `unavailable` rather than crashing if model load fails.
- Enforce timeout.

Result shape:

```ts
{
  layer: "ml",
  status: "complete",
  probability: 0.94,
  modelVersion: "2026.05.26-001",
  featureSchemaVersion: "url-features-v1",
  durationMs: 83
}
```

## Release Checklist

- Dataset license reviewed.
- Feature schema documented.
- Metrics generated.
- Confusion matrix saved.
- ONNX round-trip test passes.
- Browser worker test passes.
- Feature parity snapshot passes.
- Model metadata updated.
- README metric claims updated only with measured values.
