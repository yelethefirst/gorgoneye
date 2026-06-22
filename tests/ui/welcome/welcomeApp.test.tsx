import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { App } from "../../../entrypoints/welcome/App";

describe("Welcome App (initial render)", () => {
  it("starts on the intro step with the welcome heading and a step indicator", () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain("Welcome to Aegis Gorgon");
    expect(html).toContain("Step 1 of 4");
  });

  it("renders Next, Skip, and no Back on the first step", () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain(">Skip<");
    expect(html).toContain(">Next<");
    expect(html).not.toContain(">Back<");
  });

  it("mentions the core privacy promise on the intro step", () => {
    const html = renderToStaticMarkup(<App />);
    expect(html.toLowerCase()).toContain("locally");
    expect(html.toLowerCase()).toContain("no email content");
  });
});
