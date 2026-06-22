"""Builds the training dataset from PhishTank / OpenPhish / Tranco inputs.

Supported input formats (read order is the precedence order — later sources
*append*, do not overwrite):

  --phishtank PATH    CSV with column 'url'; all rows labelled is_phishing=1
  --openphish PATH    TXT one URL per line; all rows labelled is_phishing=1
  --tranco PATH       Tranco top-list CSV (rank,domain) — labels with
                      is_phishing=0 and a synthetic https:// prefix
  --use-sample        Use the bundled synthetic dataset (committed); ideal
                      for CI smoke tests where downloads aren't possible.

Output:
  artifacts/dataset.parquet     deduplicated, shuffled, with columns
                                  url, is_phishing, source, observed_at

No raw input file is committed; raw datasets must be downloaded and placed
under training/raw/ (gitignored). The bundled synthetic dataset is
committed as a 200-row CSV to exercise the pipeline end-to-end.
"""

from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent
ARTIFACTS = ROOT / "artifacts"
SAMPLE = ROOT / "sample_dataset.csv"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _load_phishtank(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path)
    if "url" not in df.columns:
        raise ValueError(f"{path}: PhishTank CSV must have a 'url' column")
    return pd.DataFrame(
        {
            "url": df["url"].astype(str),
            "is_phishing": 1,
            "source": "phishtank",
            "observed_at": _now_iso(),
        }
    )


def _load_openphish(path: Path) -> pd.DataFrame:
    lines = [
        line.strip()
        for line in path.read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.startswith("#")
    ]
    return pd.DataFrame(
        {
            "url": lines,
            "is_phishing": 1,
            "source": "openphish",
            "observed_at": _now_iso(),
        }
    )


def _load_tranco(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path, header=None, names=["rank", "domain"])
    return pd.DataFrame(
        {
            "url": "https://" + df["domain"].astype(str) + "/",
            "is_phishing": 0,
            "source": "tranco",
            "observed_at": _now_iso(),
        }
    )


def _load_sample() -> pd.DataFrame:
    if not SAMPLE.exists():
        raise FileNotFoundError(
            f"Sample dataset missing at {SAMPLE}. "
            "Run training/generate_sample.py to recreate it."
        )
    df = pd.read_csv(SAMPLE)
    return df


def build(args: argparse.Namespace) -> Path:
    frames: list[pd.DataFrame] = []
    if args.use_sample:
        frames.append(_load_sample())
    if args.phishtank:
        frames.append(_load_phishtank(Path(args.phishtank)))
    if args.openphish:
        frames.append(_load_openphish(Path(args.openphish)))
    if args.tranco:
        frames.append(_load_tranco(Path(args.tranco)))

    if not frames:
        raise SystemExit(
            "No input sources specified. Pass --use-sample or one of "
            "--phishtank/--openphish/--tranco."
        )

    combined = pd.concat(frames, ignore_index=True)
    # Dedup on the URL, prefer phishing label if both labels exist.
    combined = combined.sort_values("is_phishing", ascending=False)
    combined = combined.drop_duplicates(subset=["url"], keep="first")
    # Shuffle deterministically so training/val splits are stable.
    combined = combined.sample(frac=1.0, random_state=20260601).reset_index(drop=True)

    ARTIFACTS.mkdir(exist_ok=True)
    out_path = ARTIFACTS / "dataset.parquet"
    combined.to_parquet(out_path, index=False)

    n = len(combined)
    n_phish = int(combined["is_phishing"].sum())
    print(f"build_dataset: wrote {n} rows ({n_phish} phishing / {n - n_phish} benign) -> {out_path}")
    return out_path


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Build the training dataset")
    parser.add_argument("--phishtank", help="Path to PhishTank CSV")
    parser.add_argument("--openphish", help="Path to OpenPhish TXT")
    parser.add_argument("--tranco", help="Path to Tranco CSV (rank,domain)")
    parser.add_argument(
        "--use-sample",
        action="store_true",
        help="Use the bundled synthetic dataset (no downloads required)",
    )
    args = parser.parse_args(argv)
    build(args)
    return 0


if __name__ == "__main__":
    sys.exit(main())
