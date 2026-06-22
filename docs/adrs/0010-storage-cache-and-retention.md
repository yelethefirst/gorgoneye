# ADR-0010: Local Storage, Cache, And Retention

## Status

Accepted

## Context

The extension needs to persist settings, cache verdicts, store model metadata, maintain threat-intelligence data, and show audit logs. Some of this data is sensitive because it can reveal browsing or email-link patterns.

## Decision

Use local browser storage only for MVP:

- `chrome.storage.local` for user settings and small preferences.
- IndexedDB via `idb` for verdict cache, audit log, Safe Browsing metadata, model metadata, brand hashes, and training progress.

Retention:

- Verdict cache defaults to 24 hours.
- Audit log defaults to 24 hours.
- Training progress persists until user clears it.
- Model metadata persists until model update or user cache clear.
- Raw screenshots are not persisted.
- Raw email content is never persisted.

## Consequences

Benefits:

- Keeps data local.
- Gives users a clear cache-clearing story.
- Supports fast repeat scans.
- Avoids service-worker memory loss.

Costs:

- Local storage can still be sensitive if a device is compromised.
- Requires TTL cleanup jobs.
- Requires migrations as schemas evolve.

## Alternatives Considered

Remote account sync:

- Useful later for enterprise policy, but out of scope for privacy-first MVP.

No caching:

- Simpler privacy story, but worse performance and more repeated lookups.
