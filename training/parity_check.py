"""Validates that the Python feature extractor matches the frozen TypeScript
snapshot at ``tests/ml/__snapshots__/featureParity.json``.

Run this BEFORE editing features on either side. If it fails, one of the two
implementations drifted — investigate which one and fix that, do NOT mutate
the snapshot to make this script pass.

Exit codes:
  0 — all features match within tolerance
  1 — at least one URL drifted
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

from features import extract_features_by_name, FEATURE_NAMES

SNAPSHOT_PATH = (
    Path(__file__).resolve().parents[1]
    / "tests"
    / "ml"
    / "__snapshots__"
    / "featureParity.json"
)

TOLERANCE = 1e-6


def main() -> int:
    payload = json.loads(SNAPSHOT_PATH.read_text(encoding="utf-8"))
    rows = payload["rows"]
    schema_version = payload["featureSchemaVersion"]
    print(f"parity_check: snapshot v{schema_version}, {len(rows)} URLs")

    failures: list[str] = []
    for row in rows:
        url = row["url"]
        expected = row["features"]
        actual = extract_features_by_name(url)
        if set(actual.keys()) != set(expected.keys()):
            failures.append(f"{url}: feature keys differ")
            continue
        for name in FEATURE_NAMES:
            a = float(actual[name])
            e = float(expected[name])
            if math.isnan(a) or math.isnan(e):
                failures.append(f"{url}: NaN in feature {name}")
                continue
            if abs(a - e) > TOLERANCE:
                failures.append(
                    f"{url}: feature '{name}' drifted "
                    f"(python={a}, snapshot={e}, diff={abs(a-e):.6g})"
                )

    if failures:
        print(f"\nparity_check: FAILED ({len(failures)} divergences)")
        for f in failures[:25]:
            print(f"  - {f}")
        if len(failures) > 25:
            print(f"  ... and {len(failures) - 25} more")
        return 1

    print("parity_check: OK — Python matches the snapshot byte-for-byte")
    return 0


if __name__ == "__main__":
    sys.exit(main())
