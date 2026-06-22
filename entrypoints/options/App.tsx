import { Badge, Panel } from "../../src/ui/components";
import { AuditTable } from "../../src/ui/options/AuditTable";
import { PrivacyVerifier } from "../../src/ui/options/PrivacyVerifier";
import { useSettings } from "../../src/ui/options/useSettings";
import { LayerTogglesPanel } from "../../src/ui/options/LayerTogglesPanel";
import { TrustedDomainsPanel } from "../../src/ui/options/TrustedDomainsPanel";
import { TelemetryPanel } from "../../src/ui/options/TelemetryPanel";
import { ClearDataPanel } from "../../src/ui/options/ClearDataPanel";

function SectionHeading({ title }: { title: string }) {
  return (
    <h2 className="mt-8 mb-2 text-sm font-semibold uppercase tracking-wide text-text-tertiary">
      {title}
    </h2>
  );
}

export function App() {
  const { settings, loading, error, update } = useSettings();

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 font-sans text-text-primary">
      <header className="mb-6">
        <h1 className="text-xl font-semibold">Aegis Gorgon — Settings</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Configure detection layers, manage trusted domains, audit outbound calls,
          and run the privacy verifier. Everything on this page is local.
        </p>
      </header>

      <Panel title="Verdict palette" description="Reference for every layer's display.">
        <div className="flex flex-wrap gap-2">
          <Badge verdict="safe" />
          <Badge verdict="suspicious" />
          <Badge verdict="phishing" />
          <Badge verdict="unknown" />
        </div>
      </Panel>

      {error && (
        <div
          role="alert"
          className="mt-4 rounded border border-verdict-phishing/30 bg-verdict-phishing-soft px-2 py-1 text-sm text-verdict-phishing"
        >
          {error}
        </div>
      )}

      <SectionHeading title="Detection" />
      {settings ? (
        <LayerTogglesPanel
          settings={settings}
          onChange={(key, next) =>
            void update({ layers: { ...settings.layers, [key]: next } })
          }
        />
      ) : (
        <Panel>
          <p className="text-xs text-text-tertiary">
            {loading ? "Loading settings…" : "Settings unavailable."}
          </p>
        </Panel>
      )}

      <SectionHeading title="Trust" />
      {settings && (
        <TrustedDomainsPanel
          domains={settings.trustedDomains}
          onChange={(next) => void update({ trustedDomains: next })}
        />
      )}

      <SectionHeading title="Telemetry" />
      {settings && (
        <TelemetryPanel
          telemetryOptIn={settings.telemetryOptIn}
          onChange={(next) => void update({ telemetryOptIn: next })}
        />
      )}

      <SectionHeading title="Privacy" />
      <PrivacyVerifier />
      <AuditTable />

      <SectionHeading title="Maintenance" />
      <ClearDataPanel />
    </main>
  );
}
