import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { VerdictDetailPanel } from "../../src/ui/popup/VerdictDetailPanel";
import { analyzeUrl } from "../../src/detection/analyzeUrl";

async function render(rawUrl: string): Promise<string> {
  const result = await analyzeUrl({
    url: rawUrl,
    context: { surface: "test_fixture", userGesture: "manual_scan" },
  });
  return renderToStaticMarkup(
    <VerdictDetailPanel result={result} onBack={() => {}} onExplain={async () => {}} />,
  );
}

describe("VerdictDetailPanel", () => {
  it("shows the verdict badge and the URL", async () => {
    const html = await render("http://paypal.com@192.168.0.1/login?next=http://evil.tk/steal");
    expect(html).toContain("Verdict: Phishing");
    expect(html).toContain("192.168.0.1");
  });

  it("shows the rules layer with status and percentage score", async () => {
    const html = await render(
      "http://paypal.com@192.168.0.1/login?next=http://evil.tk/steal",
    );
    expect(html).toContain("Rules engine");
    expect(html).toContain("Status: complete");
    expect(html).toMatch(/\d+%/);
  });

  it("lists unavailable layers with their reasons", async () => {
    const html = await render("https://example.com/");
    expect(html).toContain("Local ML classifier");
    expect(html).toContain("Threat intelligence");
    expect(html).toContain("Visual brand inspection");
    expect(html).toContain("Unavailable");
    expect(html).toContain("Local ML classifier");
  });

  it("renders each fired signal with its severity tag", async () => {
    const html = await render(
      "http://paypal.com@192.168.0.1/login?next=http://evil.tk/steal",
    );
    // Multiple rules fire for this fixture; at least one HIGH-severity tag should appear.
    expect(html.toLowerCase()).toContain("high");
    expect(html).toContain("Embedded credentials");
  });

  it("renders the privacy summary with all six items", async () => {
    const html = await render("https://example.com/");
    expect(html).toContain("Email content stayed on device");
    expect(html).toContain("No full URL sent to Aegis services");
    expect(html).toContain("No full URL sent to threat intel");
    expect(html).toContain("Hash prefix sent to threat intel");
    expect(html).toContain("No target-origin request made");
    expect(html).toContain("No telemetry sent");
  });

  it("renders an Explain button", async () => {
    const html = await render("https://example.com/");
    expect(html).toContain("Explain this verdict");
  });

  it("renders a Back button", async () => {
    const html = await render("https://example.com/");
    expect(html).toContain("Back to popup");
  });

  it("hides the 'Inspect visually' button when the visual layer is disabled", async () => {
    const result = await analyzeUrl({
      url: "https://paypa1.example/login",
      context: { surface: "test_fixture", userGesture: "manual_scan" },
    });
    const html = renderToStaticMarkup(
      <VerdictDetailPanel
        result={result}
        onBack={() => {}}
        onInspectVisually={async () => {}}
        visualInspectionEnabled={false}
      />,
    );
    expect(html).not.toContain("Inspect visually");
  });

  it("shows the 'Inspect visually' button when the layer is enabled and no visual result yet", async () => {
    const result = await analyzeUrl({
      url: "https://paypa1.example/login",
      context: { surface: "test_fixture", userGesture: "manual_scan" },
    });
    const html = renderToStaticMarkup(
      <VerdictDetailPanel
        result={result}
        onBack={() => {}}
        onInspectVisually={async () => {}}
        visualInspectionEnabled
      />,
    );
    expect(html).toContain("Inspect visually");
  });
});
