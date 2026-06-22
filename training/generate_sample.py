"""Generates `sample_dataset.csv` — a synthetic 200-row CSV used by CI when
real phishing datasets aren't available.

All hostnames are synthetic. None resolve to real attackers. Run this script
to regenerate the file; the output is committed.
"""

from __future__ import annotations

import csv
import random
from datetime import datetime, timezone
from pathlib import Path

OUT = Path(__file__).resolve().parent / "sample_dataset.csv"

SAFE_TEMPLATES = [
    "https://{name}.example.com/",
    "https://www.{name}.example.org/",
    "https://docs.{name}.example.io/",
    "https://blog.{name}.example.net/",
    "https://shop.{name}.example.dev/products",
    "https://api.{name}.example.com/v1/users",
    "https://{name}.example.com/article/123",
    "https://news.{name}.example.org/category/tech",
]

BRAND_TYPOS = [
    "paypa1", "goog1e", "micr0soft", "amaz0n", "netfllx", "1inkedin",
    "app1e", "faceb00k", "githuhb", "drobpox", "g1tlab", "tw1tter",
]

PHISH_TEMPLATES = [
    "http://{brand}.example/login",
    "https://{brand}.com/account/verify",
    "http://10.0.{a}.{b}/{path}",
    "http://192.168.{a}.{b}/secure/login",
    "http://paypal.com@{brand}.example/login?next=http://attacker.tld/{path}",
    "https://{brand}.click/secure-update",
    "https://{brand}.top/free-stuff/login",
    "https://{brand}.zip/{path}",
    "https://xn--80ak6aa92e.{brand}.com/verify",
    "https://promo.{brand}-update.example/account/verify-account",
]

SAFE_WORDS = [
    "react", "vue", "django", "rails", "python", "node", "rust", "go",
    "linux", "kafka", "redis", "postgres", "mongo", "elastic", "kibana",
    "tracing", "metrics", "monitor", "alert", "stack",
]

PATH_WORDS = ["info", "details", "more", "next", "here", "view", "go", "page"]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def gen_safe(rng: random.Random) -> str:
    template = rng.choice(SAFE_TEMPLATES)
    return template.format(name=rng.choice(SAFE_WORDS))


def gen_phish(rng: random.Random) -> str:
    template = rng.choice(PHISH_TEMPLATES)
    return template.format(
        brand=rng.choice(BRAND_TYPOS),
        a=rng.randint(0, 254),
        b=rng.randint(1, 254),
        path=rng.choice(PATH_WORDS),
    )


def main() -> int:
    rng = random.Random(20260601)
    rows: list[tuple[str, int, str, str]] = []
    seen: set[str] = set()
    iso = now_iso()
    target = 200
    while len(rows) < target:
        if len(rows) % 2 == 0:
            url = gen_safe(rng)
            label = 0
            source = "synthetic_safe"
        else:
            url = gen_phish(rng)
            label = 1
            source = "synthetic_phish"
        if url in seen:
            continue
        seen.add(url)
        rows.append((url, label, source, iso))

    with OUT.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        writer.writerow(["url", "is_phishing", "source", "observed_at"])
        writer.writerows(rows)

    print(f"generate_sample: wrote {len(rows)} rows -> {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
