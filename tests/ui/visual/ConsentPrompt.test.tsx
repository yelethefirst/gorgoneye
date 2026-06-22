import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ConsentPrompt } from "../../../src/ui/visual/ConsentPrompt";

const REQUEST = {
  urlDisplay: "https://target.example/login",
  triggeredBy: { verdict: "phishing" as const, topSignal: "Typosquatting" },
};

describe("ConsentPrompt (stub render smoke)", () => {
  it("renders as role=alertdialog with modal markup", () => {
    const html = renderToStaticMarkup(
      <ConsentPrompt request={REQUEST} onDecide={() => {}} />,
    );
    expect(html).toContain('role="alertdialog"');
    expect(html).toContain('aria-modal="true"');
  });

  it("shows the required three copy lines in order (action, data, privacy)", () => {
    const html = renderToStaticMarkup(
      <ConsentPrompt request={REQUEST} onDecide={() => {}} />,
    );
    const actionIdx = html.indexOf("id=\"aegis-consent-action\"");
    const dataIdx = html.indexOf("id=\"aegis-consent-data\"");
    const privacyIdx = html.indexOf("id=\"aegis-consent-privacy\"");
    expect(actionIdx).toBeGreaterThan(-1);
    expect(dataIdx).toBeGreaterThan(actionIdx);
    expect(privacyIdx).toBeGreaterThan(dataIdx);
  });

  it("includes the target URL display string", () => {
    const html = renderToStaticMarkup(
      <ConsentPrompt request={REQUEST} onDecide={() => {}} />,
    );
    expect(html).toContain("target.example");
  });

  it("renders Cancel before Inspect (Cancel must be the default-focused action)", () => {
    const html = renderToStaticMarkup(
      <ConsentPrompt request={REQUEST} onDecide={() => {}} />,
    );
    const cancelIdx = html.indexOf(">Cancel<");
    const inspectIdx = html.indexOf(">Inspect this URL<");
    expect(cancelIdx).toBeGreaterThan(-1);
    expect(inspectIdx).toBeGreaterThan(cancelIdx);
  });

  it("does NOT render an iframe or img tag (no remote resource leak)", () => {
    const html = renderToStaticMarkup(
      <ConsentPrompt request={REQUEST} onDecide={() => {}} />,
    );
    expect(html).not.toContain("<iframe");
    expect(html).not.toContain("<img");
  });

  it("surfaces the triggeredBy context", () => {
    const html = renderToStaticMarkup(
      <ConsentPrompt request={REQUEST} onDecide={() => {}} />,
    );
    expect(html).toContain("phishing");
    expect(html).toContain("Typosquatting");
  });
});
