# ADR-0005: Local ONNX ML Classifier

## Status

Accepted

## Context

The product needs a learned detector while preserving the local-first privacy model. Cloud ML inference would be easier to update but would require sending URLs or features to a server. That is not acceptable for the default product path.

## Decision

Train a URL classifier offline and run inference locally in the browser.

Implementation target:

- Train with Python using PhishTank, OpenPhish, and legitimate-domain datasets.
- Use XGBoost for the initial model because it performs well on tabular URL features and exports cleanly.
- Export to ONNX.
- Run inference with `onnxruntime-web` in a dedicated worker.
- Keep the model under 5 MB for MVP.
- Version the feature schema and model artifact together.

## Consequences

Benefits:

- No URL or feature-vector upload.
- Fast local inference.
- Predictable deployment artifact.
- Easy to benchmark and regression-test.

Costs:

- Model updates require shipping a new asset or secure update path.
- Python and TypeScript feature extraction must stay exactly aligned.
- The model can become stale without a release process.

## Alternatives Considered

Cloud-hosted classifier:

- Easier to update, but conflicts with privacy goals.

Neural URL model:

- Potentially stronger, but larger and harder to explain for an MVP.

Rules only:

- Simpler, but less effective against blended attacks.
