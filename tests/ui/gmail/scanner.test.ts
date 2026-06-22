// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  extractGmailHeaderText,
  extractUnscannedAnchors,
  startGmailScanner,
} from "../../../src/ui/gmail/scanner";
import { analyzeUrl } from "../../../src/detection/analyzeUrl";
import { BADGE_CLASS, POPOVER_CLASS } from "../../../src/ui/badges/badge";

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function setMessageBody(html: string) {
  document.body.innerHTML = `<div role="main">${html}</div>`;
}

describe("extractUnscannedAnchors", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("returns only anchors inside [role=main] with http(s) hrefs", () => {
    document.body.innerHTML = `
      <a href="https://outside.example/">should be ignored (outside main)</a>
      <div role="main">
        <a href="https://example.com/a">inside</a>
        <a href="mailto:alice@example.com">non-http</a>
        <a href="https://example.com/b">inside b</a>
      </div>
    `;
    const anchors = extractUnscannedAnchors(document);
    const hrefs = anchors.map((a) => a.href);
    expect(hrefs).toEqual([
      "https://example.com/a",
      "https://example.com/b",
    ]);
  });

  it("skips anchors already tagged data-aegis-scanned", () => {
    document.body.innerHTML = `
      <div role="main">
        <a href="https://example.com/a" data-aegis-scanned="complete">already</a>
        <a href="https://example.com/b">new</a>
      </div>
    `;
    const anchors = extractUnscannedAnchors(document);
    expect(anchors).toHaveLength(1);
    expect(anchors[0]!.href).toBe("https://example.com/b");
  });

  it("returns [] when no [role=main] is present", () => {
    document.body.innerHTML = `<a href="https://example.com/">nope</a>`;
    expect(extractUnscannedAnchors(document)).toHaveLength(0);
  });
});

describe("startGmailScanner", () => {
  let analyze: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    document.body.innerHTML = "";
    analyze = vi.fn(async (url: string) =>
      analyzeUrl({
        url,
        context: { surface: "gmail", userGesture: "email_open" },
      }),
    );
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("scans existing anchors on start and renders a badge per anchor", async () => {
    setMessageBody(`
      <a href="https://github.com/aegishield">safe</a>
      <a href="https://paypa1.example/login">phishing</a>
    `);
    const handle = startGmailScanner({ root: document, analyze });
    await handle.scan();

    expect(analyze).toHaveBeenCalledTimes(2);
    const badges = document.querySelectorAll(`.${BADGE_CLASS}`);
    expect(badges).toHaveLength(2);
    // The safe URL gets a green badge; phishing gets red. We assert label text.
    const labels = Array.from(badges).map((b) => b.textContent);
    expect(labels).toEqual(expect.arrayContaining(["Safe", "Phishing"]));
    handle.stop();
  });

  it("does not double-scan the same anchor on a second pass", async () => {
    setMessageBody(`<a href="https://github.com/aegishield">a</a>`);
    const handle = startGmailScanner({ root: document, analyze });
    await handle.scan();
    await handle.scan();
    expect(analyze).toHaveBeenCalledTimes(1);
    handle.stop();
  });

  it("picks up anchors added dynamically (SPA navigation)", async () => {
    setMessageBody(`<a href="https://github.com/aegishield">first</a>`);
    const handle = startGmailScanner({ root: document, analyze });
    await handle.scan();
    expect(analyze).toHaveBeenCalledTimes(1);

    // Simulate Gmail rendering a newly opened message.
    const main = document.querySelector('[role="main"]')!;
    const a = document.createElement("a");
    a.href = "https://news.ycombinator.com/item?id=42";
    a.textContent = "new";
    main.appendChild(a);

    await flush(); // let the MutationObserver fire
    await handle.scan();
    expect(analyze).toHaveBeenCalledTimes(2);
    handle.stop();
  });

  it("stop() prevents subsequent scans", async () => {
    setMessageBody(`<a href="https://github.com/aegishield">a</a>`);
    const handle = startGmailScanner({ root: document, analyze });
    handle.stop();
    await handle.scan();
    expect(analyze).not.toHaveBeenCalled();
  });

  it("renders a popover when the badge is clicked, then closes it", async () => {
    setMessageBody(`<a href="https://paypa1.example/login">phishing</a>`);
    const handle = startGmailScanner({ root: document, analyze });
    await handle.scan();

    const badge = document.querySelector<HTMLButtonElement>(`.${BADGE_CLASS}`)!;
    expect(badge).not.toBeNull();
    badge.click();
    const popover = document.querySelector(`.${POPOVER_CLASS}`);
    expect(popover, "popover should appear after click").not.toBeNull();
    expect(popover!.textContent).toContain("Phishing");

    // Click the popover's Close button.
    const closeBtn = popover!.querySelector<HTMLButtonElement>("button")!;
    closeBtn.click();
    expect(document.querySelector(`.${POPOVER_CLASS}`)).toBeNull();
    handle.stop();
  });

  it("forwards the extracted email header text to analyze() for each link in the email", async () => {
    setMessageBody(`<a href="https://paypa1.example/login">phishing</a>`);
    const headerText =
      "Authentication-Results: mail.recipient.example; spf=fail; dkim=fail; dmarc=fail";
    const handle = startGmailScanner({
      root: document,
      analyze,
      extractEmailHeaderText: () => headerText,
    });
    await handle.scan();
    expect(analyze).toHaveBeenCalledTimes(1);
    expect(analyze).toHaveBeenCalledWith(
      "https://paypa1.example/login",
      { emailHeaderText: headerText },
    );
    handle.stop();
  });

  it("when no headers are extractable, analyze() is called with an empty options object", async () => {
    setMessageBody(`<a href="https://example.com/">x</a>`);
    const handle = startGmailScanner({
      root: document,
      analyze,
      extractEmailHeaderText: () => null,
    });
    await handle.scan();
    expect(analyze).toHaveBeenCalledTimes(1);
    expect(analyze).toHaveBeenCalledWith("https://example.com/", {});
    handle.stop();
  });
});

describe("extractGmailHeaderText", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("returns null on a normal Gmail message view (no ?view=om in URL)", () => {
    // Note: happy-dom inits location.search to empty string by default.
    document.body.innerHTML = `<pre>Received: ...\nAuthentication-Results: ...\n\nbody text</pre>`;
    expect(extractGmailHeaderText(document)).toBeNull();
  });

  it("returns the pre-blank-line slice when on a ?view=om page", () => {
    history.replaceState(null, "", "/mail/u/0/?ik=abc&view=om&permmsgid=xyz");
    document.body.innerHTML = [
      "<pre>",
      "Authentication-Results: mail.example.com;",
      "        spf=pass smtp.mailfrom=ok.example;",
      "        dkim=pass header.i=@ok.example;",
      "        dmarc=pass policy=reject",
      "From: News <news@example.com>",
      "",
      "Hello, this is the message body and should NOT appear.",
      "</pre>",
    ].join("\n");
    const text = extractGmailHeaderText(document);
    expect(text).not.toBeNull();
    expect(text!).toContain("Authentication-Results");
    expect(text!).toContain("dmarc=pass");
    expect(text!).not.toContain("message body");
    // Reset history for subsequent tests.
    history.replaceState(null, "", "/");
  });

  it("returns null when on ?view=om but no <pre> with content is present", () => {
    history.replaceState(null, "", "/?view=om");
    document.body.innerHTML = "<div>no pre block here</div>";
    expect(extractGmailHeaderText(document)).toBeNull();
    history.replaceState(null, "", "/");
  });
});
