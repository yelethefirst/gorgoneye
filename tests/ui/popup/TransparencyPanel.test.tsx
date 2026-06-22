import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TransparencyPanel } from "../../../src/ui/popup/TransparencyPanel";
import { computeTransparency } from "../../../src/ui/popup/transparencyState";
import { DEFAULT_SETTINGS } from "../../../src/storage/settings";

const NOW = Date.parse("2026-05-27T12:00:00.000Z");

describe("TransparencyPanel (render smoke)", () => {
  it("renders the green-light state when there's been no outbound activity", () => {
    const state = computeTransparency({
      settings: DEFAULT_SETTINGS,
      auditRecords: [],
      lastVerdict: null,
      now: NOW,
    });
    const html = renderToStaticMarkup(<TransparencyPanel state={state} ageSeconds={1} />);
    expect(html).toContain("Live transparency");
    expect(html).toContain("Nothing left the device");
    expect(html).toContain("Updated 1s ago");
  });

  it("renders red-light copy when a full URL was sent", () => {
    const state = computeTransparency({
      settings: DEFAULT_SETTINGS,
      auditRecords: [
        {
          id: "x",
          timestamp: new Date(NOW - 10_000).toISOString(),
          destinationHostname: "target.example",
          method: "GET",
          purpose: "visual_inspection_target_origin",
          dataCategory: "target_origin_request",
          requestBytes: 100,
          responseBytes: 200,
          status: 200,
          containsEmailContent: false,
          containsFullScannedUrl: true,
          userConsented: true,
        },
      ],
      lastVerdict: null,
      now: NOW,
    });
    const html = renderToStaticMarkup(<TransparencyPanel state={state} ageSeconds={0} />);
    expect(html).toContain("full URL");
  });

  it("renders the layer board (rules and threat-intel rows visible)", () => {
    const state = computeTransparency({
      settings: DEFAULT_SETTINGS,
      auditRecords: [],
      lastVerdict: null,
      now: NOW,
    });
    const html = renderToStaticMarkup(<TransparencyPanel state={state} ageSeconds={0} />);
    expect(html).toContain("Rules");
    expect(html).toContain("Threat intel");
    expect(html).toContain("always on");
  });
});
