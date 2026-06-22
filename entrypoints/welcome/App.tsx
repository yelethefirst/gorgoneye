import { useState } from "react";
import { Badge, Button, Panel } from "../../src/ui/components";
import {
  isLastStep,
  nextStep,
  prevStep,
  stepIndex,
  STEP_ORDER,
  type StepId,
} from "../../src/ui/welcome/steps";

interface StepConfig {
  id: StepId;
  title: string;
  body: React.ReactNode;
}

const STEPS: Record<Exclude<StepId, "done">, StepConfig> = {
  intro: {
    id: "intro",
    title: "Welcome to Aegis Gorgon",
    body: (
      <>
        <p className="text-sm">
          Aegis is a privacy-preserving phishing defense that runs inside your browser.
          Every URL you hover, click, or open in webmail is evaluated <strong>locally</strong> —
          no email content, no full URLs, no telemetry leave your device by default.
        </p>
        <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-text-secondary">
          <li>Rule-based URL analysis (always on)</li>
          <li>Optional Safe Browsing hash-prefix lookup (opt-in, hashes only)</li>
          <li>Verdicts inline in Gmail and on hover everywhere else</li>
        </ul>
      </>
    ),
  },
  privacy: {
    id: "privacy",
    title: "What stays on your device",
    body: (
      <>
        <p className="text-sm">
          The non-negotiables Aegis ships with:
        </p>
        <ul className="mt-3 space-y-2 text-sm">
          <li className="flex items-start gap-2">
            <Badge verdict="safe" size="sm">✓</Badge>
            <span>Email content never leaves your device.</span>
          </li>
          <li className="flex items-start gap-2">
            <Badge verdict="safe" size="sm">✓</Badge>
            <span>Full scanned URLs are never sent to any Aegis service.</span>
          </li>
          <li className="flex items-start gap-2">
            <Badge verdict="safe" size="sm">✓</Badge>
            <span>
              Safe Browsing lookups, when you enable them, send only a 4-byte
              hash prefix — never the URL.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Badge verdict="safe" size="sm">✓</Badge>
            <span>Telemetry is opt-in and off by default.</span>
          </li>
        </ul>
        <p className="mt-3 text-xs text-text-secondary">
          You can verify these claims at any time from the settings page's
          one-click privacy verifier.
        </p>
      </>
    ),
  },
  pin: {
    id: "pin",
    title: "Pin Aegis to your toolbar",
    body: (
      <>
        <p className="text-sm">
          Pinning the extension makes it one click away. We can't pin it for you,
          but here's how:
        </p>
        <ol className="mt-3 list-inside list-decimal space-y-1 text-sm">
          <li>
            Click the puzzle-piece icon (<span aria-hidden>🧩</span>) in the
            top-right corner of your browser.
          </li>
          <li>
            Find <strong>Aegis Gorgon</strong> in the list.
          </li>
          <li>
            Click the pin icon next to it. The Aegis icon will move into the
            toolbar.
          </li>
        </ol>
      </>
    ),
  },
  ready: {
    id: "ready",
    title: "You're ready",
    body: (
      <>
        <p className="text-sm">
          Aegis is now protecting every tab. A couple of things to try:
        </p>
        <ul className="mt-3 list-inside list-disc space-y-1 text-sm">
          <li>
            Open Gmail. Links inside open messages get a small verdict badge.
          </li>
          <li>
            Hover any link on a webpage — if it looks risky, a mini warning appears.
          </li>
          <li>
            Open the popup and try the manual scan with{" "}
            <code className="text-xs">https://paypa1.example/login</code>.
          </li>
          <li>
            Visit the settings page to add trusted domains or run the privacy verifier.
          </li>
        </ul>
      </>
    ),
  },
};

export function App() {
  const [step, setStep] = useState<StepId>("intro");

  if (step === "done") {
    return <DoneScreen onReopen={() => setStep("intro")} />;
  }

  const current = STEPS[step];
  const idx = stepIndex(step);
  const last = isLastStep(step);

  return (
    <main className="mx-auto max-w-xl px-4 py-12 font-sans text-text-primary">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Aegis Gorgon</h1>
        <span className="text-xs uppercase tracking-wide text-text-tertiary" aria-live="polite">
          Step {idx + 1} of {STEP_ORDER.length}
        </span>
      </header>

      <Panel title={current.title}>{current.body}</Panel>

      <div className="mt-6 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => setStep("done")}>
          Skip
        </Button>
        <div className="flex gap-2">
          {idx > 0 && (
            <Button variant="secondary" size="sm" onClick={() => setStep(prevStep(step))}>
              Back
            </Button>
          )}
          <Button variant="primary" size="sm" onClick={() => setStep(nextStep(step))}>
            {last ? "Finish" : "Next"}
          </Button>
        </div>
      </div>
    </main>
  );
}

function DoneScreen({ onReopen }: { onReopen: () => void }) {
  return (
    <main className="mx-auto max-w-xl px-4 py-12 font-sans text-text-primary">
      <Panel
        title="You're set."
        description="You can close this tab. Aegis is already protecting every tab you open."
      >
        <p className="text-sm">
          Open the popup any time to see live transparency and recent verdicts.
        </p>
        <div className="mt-4 flex gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              window.close();
            }}
          >
            Close this tab
          </Button>
          <Button variant="ghost" size="sm" onClick={onReopen}>
            Show the tour again
          </Button>
        </div>
      </Panel>
    </main>
  );
}
