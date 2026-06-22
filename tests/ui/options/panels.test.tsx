import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LayerTogglesPanel } from "../../../src/ui/options/LayerTogglesPanel";
import { TrustedDomainsPanel } from "../../../src/ui/options/TrustedDomainsPanel";
import { TelemetryPanel } from "../../../src/ui/options/TelemetryPanel";
import { DEFAULT_SETTINGS } from "../../../src/storage/settings";

describe("LayerTogglesPanel (render smoke)", () => {
  it("renders all six layer rows", () => {
    const html = renderToStaticMarkup(
      <LayerTogglesPanel settings={DEFAULT_SETTINGS} onChange={() => {}} />,
    );
    expect(html).toContain("Rule-based URL analysis");
    expect(html).toContain("Safe Browsing");
    expect(html).toContain("Local ML classifier");
    expect(html).toContain("Local LLM");
    expect(html).toContain("Visual brand inspection");
    expect(html).toContain("Email header analysis");
  });

  it("disables the always-on rules layer", () => {
    const html = renderToStaticMarkup(
      <LayerTogglesPanel settings={DEFAULT_SETTINGS} onChange={() => {}} />,
    );
    // After AEG-7-3 every layer is implemented; the only disabled toggle is
    // the rules row, which is always-on whenever protection is enabled.
    const disabledCount = (html.match(/aria-disabled="true"/g) ?? []).length;
    expect(disabledCount).toBeGreaterThanOrEqual(1);
  });

  it("marks the rules layer as checked by default", () => {
    const html = renderToStaticMarkup(
      <LayerTogglesPanel settings={DEFAULT_SETTINGS} onChange={() => {}} />,
    );
    // Rules is the first switch and it should be aria-checked=true.
    expect(html).toMatch(/aria-checked="true"/);
  });
});

describe("TrustedDomainsPanel (render smoke)", () => {
  it("shows an empty-state message when no domains are configured", () => {
    const html = renderToStaticMarkup(<TrustedDomainsPanel domains={[]} onChange={() => {}} />);
    expect(html).toContain("No trusted domains yet.");
  });

  it("renders each configured domain with a Remove control", () => {
    const html = renderToStaticMarkup(
      <TrustedDomainsPanel domains={["example.com", "github.com"]} onChange={() => {}} />,
    );
    expect(html).toContain("example.com");
    expect(html).toContain("github.com");
    expect(html).toContain('aria-label="Remove example.com"');
    expect(html).toContain('aria-label="Remove github.com"');
  });
});

describe("TelemetryPanel (render smoke)", () => {
  it("reflects the off state by default", () => {
    const html = renderToStaticMarkup(
      <TelemetryPanel telemetryOptIn={false} onChange={() => {}} />,
    );
    expect(html).toContain("Allow scrubbed telemetry");
    expect(html).toContain('aria-checked="false"');
  });

  it("reflects the on state", () => {
    const html = renderToStaticMarkup(<TelemetryPanel telemetryOptIn={true} onChange={() => {}} />);
    expect(html).toContain('aria-checked="true"');
  });
});
