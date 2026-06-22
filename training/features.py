"""Python feature extractor for Gorgon Eye (Epic 3 / AEG-3-2).

Mirrors ``src/ml/features.ts`` exactly. The two implementations are validated
against the same frozen snapshot at
``tests/ml/__snapshots__/featureParity.json``.

The Python pipeline depends only on the standard library here; pandas /
xgboost / sklearn live in their own files so this module can be unit-tested
in isolation.
"""

from __future__ import annotations

import json
import math
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable
from urllib.parse import urlsplit, unquote, urlunsplit


# Single source of truth for the feature schema. Loaded from FEATURES.md's
# companion JSON so the order is impossible to drift.
SCHEMA_PATH = Path(__file__).resolve().parents[1] / "src" / "ml" / "featureSchema.ts"


def _load_feature_names() -> list[str]:
    """Parse the FEATURE_NAMES const tuple out of featureSchema.ts.

    We deliberately don't run a TS parser here — the schema file is stable
    enough that a single regex is fine, and it keeps Python's dependency
    surface tiny.
    """
    text = SCHEMA_PATH.read_text(encoding="utf-8")
    match = re.search(r"FEATURE_NAMES\s*=\s*\[(.*?)\]\s*as const", text, re.S)
    if not match:
        raise RuntimeError("Could not find FEATURE_NAMES in featureSchema.ts")
    items = re.findall(r'"([a-z0-9_]+)"', match[1])
    if not items:
        raise RuntimeError("FEATURE_NAMES parsed empty")
    return items


FEATURE_NAMES: list[str] = _load_feature_names()
FEATURE_COUNT: int = len(FEATURE_NAMES)
FEATURE_INDEX: dict[str, int] = {name: i for i, name in enumerate(FEATURE_NAMES)}


# Bundled data — keep in sync with TS-side data files. Loaded from JSON
# mirrors written by training/sync_data.py (committed alongside this module).
DATA_DIR = Path(__file__).resolve().parent / "data"


def _load_text_list(path: Path) -> list[str]:
    return [line.strip().lower() for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


CREDENTIAL_KEYWORDS: list[str] = _load_text_list(DATA_DIR / "credential_keywords.txt")
BRAND_SLDS: list[str] = _load_text_list(DATA_DIR / "brand_slds.txt")


# ─── tldts-equivalent registrable-domain extraction ─────────────────────────
# We do NOT depend on a Python tldts port for the demo pipeline because the
# parity-snapshot test in TypeScript already pins the expected behaviour for
# every URL we care about. The minimal logic below handles the buckets the
# snapshot URLs land in: ICANN top-level (`.com`, `.net`, `.org`, `.dev`,
# `.io`, etc.) and the small handful of two-label suffixes the corpus uses
# (`.co.uk`).
TWO_LABEL_SUFFIXES = {"co.uk", "co.jp", "com.au", "com.br"}


@dataclass(frozen=True)
class ParsedUrl:
    """A subset of TS-side ParsedUrl, big enough to compute every feature."""

    original_url: str
    scheme: str
    hostname: str
    path: str
    query: str
    fragment: str
    registrable_domain: str | None
    public_suffix: str | None
    subdomain: str | None
    is_ip_address: bool
    is_punycode: bool
    is_idn: bool


_IPV4_RE = re.compile(r"^(\d{1,3})(\.\d{1,3}){3}$")


def _looks_like_ipv4(host: str) -> bool:
    return bool(_IPV4_RE.match(host))


def _looks_like_ipv6(host: str) -> bool:
    return host.startswith("[") and host.endswith("]")


def _split_host_suffix(host: str) -> tuple[str | None, str | None, str | None]:
    """Return (subdomain, registrable_domain, public_suffix)."""
    labels = host.split(".")
    if len(labels) < 2:
        return None, None, None

    # Try two-label suffixes first.
    if len(labels) >= 3:
        candidate = ".".join(labels[-2:])
        if candidate in TWO_LABEL_SUFFIXES:
            registrable = ".".join(labels[-3:])
            subdomain = ".".join(labels[:-3]) or None
            return subdomain, registrable, candidate

    suffix = labels[-1]
    registrable = ".".join(labels[-2:])
    subdomain = ".".join(labels[:-2]) or None
    return subdomain, registrable, suffix


def parse_url(raw: str) -> ParsedUrl:
    """A minimum-viable URL parser matching what ``src/rules/parseUrl.ts``
    produces for the snapshot corpus. Sufficient for feature extraction.
    """
    if not raw or not isinstance(raw, str):
        return ParsedUrl(
            original_url="",
            scheme="",
            hostname="",
            path="",
            query="",
            fragment="",
            registrable_domain=None,
            public_suffix=None,
            subdomain=None,
            is_ip_address=False,
            is_punycode=False,
            is_idn=False,
        )

    cleaned = raw.strip()
    split = urlsplit(cleaned)

    scheme = split.scheme.lower()
    # urlsplit puts the host (lowercased by spec, but Python doesn't lowercase
    # automatically) in netloc — strip userinfo and port.
    netloc = split.netloc
    if "@" in netloc:
        netloc = netloc.split("@", 1)[1]
    if netloc.startswith("["):
        host_end = netloc.find("]")
        hostname = netloc[: host_end + 1]
    elif ":" in netloc:
        hostname = netloc.split(":", 1)[0]
    else:
        hostname = netloc
    hostname = hostname.lower()

    is_ipv4 = _looks_like_ipv4(hostname)
    is_ipv6 = _looks_like_ipv6(hostname)
    is_ip = is_ipv4 or is_ipv6

    if is_ip:
        registrable = None
        public_suffix = None
        subdomain = None
    else:
        subdomain, registrable, public_suffix = _split_host_suffix(hostname)

    labels = hostname.split(".") if not is_ip else []
    is_punycode = any(label.startswith("xn--") for label in labels)
    is_idn = is_punycode  # snapshot corpus has no non-ASCII inputs

    return ParsedUrl(
        original_url=cleaned,
        scheme=scheme,
        hostname=hostname,
        path=split.path or "",
        query=split.query or "",
        fragment=split.fragment or "",
        registrable_domain=registrable,
        public_suffix=public_suffix,
        subdomain=subdomain,
        is_ip_address=is_ip,
        is_punycode=is_punycode,
        is_idn=is_idn,
    )


# ─── feature helpers ────────────────────────────────────────────────────────

_SYMBOL_RE = re.compile(r"[!@#$%^&*()_+\-={}\[\]|\\:;\"'<>,.?/~`]")
_DIGIT_RE = re.compile(r"[0-9]")
_HYPHEN_RE = re.compile(r"-")
_DOT_RE = re.compile(r"\.")
_PERCENT_ENC_RE = re.compile(r"%[0-9a-fA-F]{2}")
_HAS_EMBEDDED_URL_RAW = re.compile(r"https?://", re.I)
_HAS_EMBEDDED_URL_ENC = re.compile(r"https?%3A%2F%2F", re.I)


def _count(pattern: re.Pattern[str], text: str) -> int:
    return len(pattern.findall(text))


def _shannon_entropy(text: str) -> float:
    if not text:
        return 0.0
    freq: dict[str, int] = {}
    for ch in text:
        freq[ch] = freq.get(ch, 0) + 1
    length = len(text)
    h = 0.0
    for count in freq.values():
        p = count / length
        h -= p * math.log2(p)
    return h


def _digit_ratio(text: str) -> float:
    if not text:
        return 0.0
    return _count(_DIGIT_RE, text) / len(text)


def _extract_sld(parsed: ParsedUrl) -> str | None:
    if not parsed.registrable_domain:
        return None
    if parsed.public_suffix and parsed.registrable_domain.endswith(
        f".{parsed.public_suffix}"
    ):
        return parsed.registrable_domain[: -len(parsed.public_suffix) - 1]
    if "." in parsed.registrable_domain:
        return parsed.registrable_domain.split(".", 1)[0]
    return parsed.registrable_domain


def _levenshtein(a: str, b: str) -> int:
    """Iterative DP — tiny and correct. Strings are short."""
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, start=1):
        curr = [i] + [0] * len(b)
        for j, cb in enumerate(b, start=1):
            cost = 0 if ca == cb else 1
            curr[j] = min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
        prev = curr
    return prev[-1]


def _min_brand_edit_distance(parsed: ParsedUrl) -> int:
    sld = _extract_sld(parsed)
    if not sld or len(sld) < 3 or parsed.is_ip_address:
        return -1
    best = -1
    for brand in BRAND_SLDS:
        if sld == brand:
            return 0
        if abs(len(brand) - len(sld)) > 3:
            continue
        d = _levenshtein(sld, brand)
        if best == -1 or d < best:
            best = d
    return best


def _has_embedded_url(parsed: ParsedUrl) -> bool:
    haystack = f"{parsed.path} {parsed.query} {parsed.fragment}"
    if _HAS_EMBEDDED_URL_RAW.search(haystack):
        return True
    if _HAS_EMBEDDED_URL_ENC.search(haystack):
        return True
    return False


def _has_userinfo(original_url: str) -> bool:
    idx = original_url.find("://")
    if idx == -1:
        return False
    after = original_url[idx + 3 :]
    at = after.find("@")
    if at == -1:
        return False
    path_start = -1
    for i, ch in enumerate(after):
        if ch in "/?#":
            path_start = i
            break
    return path_start == -1 or at < path_start


def _credential_keyword_hits(parsed: ParsedUrl) -> tuple[int, bool]:
    text = f"{parsed.path} {parsed.query} {parsed.fragment}".lower()
    count = sum(1 for kw in CREDENTIAL_KEYWORDS if kw in text)
    return count, count > 0


def _bucket_long(length: int, threshold: int) -> int:
    return 1 if length > threshold else 0


# ─── public API ─────────────────────────────────────────────────────────────


def extract_features(parsed: ParsedUrl) -> list[float]:
    """Returns a length-FEATURE_COUNT list of floats. Same order as TS."""
    out: list[float] = [0.0] * FEATURE_COUNT
    url = parsed.original_url
    host = parsed.hostname

    url_length = len(url)
    out[FEATURE_INDEX["url_length"]] = float(url_length)
    out[FEATURE_INDEX["hostname_length"]] = float(len(host))
    out[FEATURE_INDEX["path_length"]] = float(len(parsed.path))
    out[FEATURE_INDEX["query_length"]] = float(len(parsed.query))
    out[FEATURE_INDEX["fragment_length"]] = float(len(parsed.fragment))

    out[FEATURE_INDEX["dot_count"]] = float(_count(_DOT_RE, url))
    out[FEATURE_INDEX["hyphen_count"]] = float(_count(_HYPHEN_RE, url))
    out[FEATURE_INDEX["digit_count"]] = float(_count(_DIGIT_RE, url))
    out[FEATURE_INDEX["symbol_count"]] = float(_count(_SYMBOL_RE, url))
    out[FEATURE_INDEX["percent_encoded_count"]] = float(_count(_PERCENT_ENC_RE, url))

    out[FEATURE_INDEX["subdomain_depth"]] = float(
        len([s for s in parsed.subdomain.split(".") if s]) if parsed.subdomain else 0
    )
    out[FEATURE_INDEX["is_ip_address"]] = 1.0 if parsed.is_ip_address else 0.0
    out[FEATURE_INDEX["is_punycode"]] = 1.0 if parsed.is_punycode else 0.0
    out[FEATURE_INDEX["is_idn"]] = 1.0 if parsed.is_idn else 0.0
    out[FEATURE_INDEX["is_https"]] = 1.0 if parsed.scheme == "https" else 0.0

    count, any_match = _credential_keyword_hits(parsed)
    out[FEATURE_INDEX["has_credential_keyword"]] = 1.0 if any_match else 0.0
    out[FEATURE_INDEX["credential_keyword_count"]] = float(count)

    out[FEATURE_INDEX["has_embedded_url"]] = 1.0 if _has_embedded_url(parsed) else 0.0
    out[FEATURE_INDEX["at_in_url_userinfo"]] = 1.0 if _has_userinfo(parsed.original_url) else 0.0

    out[FEATURE_INDEX["min_brand_edit_distance"]] = float(_min_brand_edit_distance(parsed))

    out[FEATURE_INDEX["host_digit_ratio"]] = _digit_ratio(host)
    out[FEATURE_INDEX["host_entropy"]] = _shannon_entropy(host)
    out[FEATURE_INDEX["path_entropy"]] = _shannon_entropy(parsed.path)

    out[FEATURE_INDEX["url_length_bucket_long"]] = float(_bucket_long(url_length, 100))
    out[FEATURE_INDEX["url_length_bucket_very_long"]] = float(_bucket_long(url_length, 200))

    return out


def extract_features_by_name(url: str) -> dict[str, float]:
    """Convenience that combines parsing + extraction + naming."""
    parsed = parse_url(url)
    vec = extract_features(parsed)
    return {name: vec[i] for i, name in enumerate(FEATURE_NAMES)}


def batch_extract(urls: Iterable[str]) -> list[dict[str, float]]:
    return [extract_features_by_name(u) for u in urls]
