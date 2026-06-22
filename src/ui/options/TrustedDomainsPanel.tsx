import { useState } from "react";
import { Button, Panel } from "../components";
import { addTrustedDomain, removeTrustedDomain, type AddError } from "./trustedDomainsReducer";

const ERROR_COPY: Record<AddError, string> = {
  empty: "Enter a domain first.",
  invalid_chars: "Only letters, digits, hyphens and dots are allowed.",
  no_dot: "Domains must contain at least one dot (e.g. example.com).",
  leading_or_trailing_dot: "Domains cannot start or end with a dot.",
  duplicate: "That domain is already on the list.",
};

export interface TrustedDomainsPanelProps {
  domains: readonly string[];
  onChange(next: string[]): void;
}

export function TrustedDomainsPanel({ domains, onChange }: TrustedDomainsPanelProps) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<AddError | null>(null);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const outcome = addTrustedDomain(domains, draft);
    if (outcome.error) {
      setError(outcome.error);
      return;
    }
    setError(null);
    setDraft("");
    onChange(outcome.next);
  };

  return (
    <Panel
      title="Trusted domains"
      description={
        "Hovered links on these hosts are skipped by the generic hover scanner. " +
        "Entries match the hostname exactly OR any subdomain — e.g. " +
        "`google.com` covers `mail.google.com`."
      }
    >
      <form onSubmit={submit} className="flex gap-2">
        <input
          type="text"
          placeholder="example.com"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="flex-1 rounded border border-surface-border bg-white px-2 py-1 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus-ring"
        />
        <Button type="submit" variant="primary" size="sm">
          Add
        </Button>
      </form>
      {error && (
        <div
          role="alert"
          className="mt-2 rounded border border-verdict-suspicious/30 bg-verdict-suspicious-soft px-2 py-1 text-xs text-verdict-suspicious"
        >
          {ERROR_COPY[error]}
        </div>
      )}

      {domains.length === 0 ? (
        <p className="mt-2 text-xs text-text-tertiary">No trusted domains yet.</p>
      ) : (
        <ul className="mt-3 space-y-1">
          {domains.map((d) => (
            <li
              key={d}
              className="flex items-center justify-between rounded border border-surface-border bg-surface px-2 py-1 text-xs"
            >
              <code>{d}</code>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onChange(removeTrustedDomain(domains, d))}
                aria-label={`Remove ${d}`}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
