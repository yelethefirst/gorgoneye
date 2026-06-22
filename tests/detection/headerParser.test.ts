import { describe, expect, it } from "vitest";
import {
  buildHeaderResult,
  parseEmailHeaders,
} from "../../src/detection/headerParser";

const ALL_PASS = `
Received: from mx.gmail.com (mx.gmail.com. [209.85.220.41]) by something.example;
Authentication-Results: mx.gmail.com;
       spf=pass (gmail.com: domain of alice@example.com designates 198.51.100.1 as permitted sender) smtp.mailfrom=alice@example.com;
       dkim=pass header.i=@example.com header.s=20221208 header.b=Abc123;
       dmarc=pass (p=NONE sp=NONE dis=NONE) header.from=example.com
Received-SPF: pass (gmail.com: domain of alice@example.com designates 198.51.100.1 as permitted sender) client-ip=198.51.100.1;
Subject: Hello
From: Alice <alice@example.com>
`;

const SPF_FAIL_DKIM_NONE = `
Authentication-Results: mx.gmail.com;
       spf=softfail;
       dkim=none;
       dmarc=fail header.from=attacker.example
Subject: Suspicious
`;

const ONLY_RECEIVED_SPF = `
Received-SPF: neutral (mx.example: 198.51.100.5 is neither permitted nor denied by domain of bob@example.com)
Subject: Plain
`;

const HEADER_CONTINUATION = `
Authentication-Results: mx.gmail.com;
       spf=pass smtp.mailfrom=alice@example.com;
       dkim=pass
         header.i=@example.com
         header.s=20221208;
       dmarc=pass header.from=example.com
`;

const NO_AUTH_HEADERS = `
Subject: Generic
From: someone@example.com
To: you@example.com
`;

describe("parseEmailHeaders", () => {
  it("extracts all three mechanisms from an Authentication-Results line", () => {
    const out = parseEmailHeaders(ALL_PASS);
    expect(out.spf).toBe("pass");
    expect(out.dkim).toBe("pass");
    expect(out.dmarc).toBe("pass");
    expect(out.hadAuthenticationResults).toBe(true);
    expect(out.hadReceivedSpf).toBe(true);
    expect(out.evidence.length).toBeGreaterThanOrEqual(1);
  });

  it("maps softfail/permerror to 'fail' and none to 'neutral'", () => {
    const out = parseEmailHeaders(SPF_FAIL_DKIM_NONE);
    expect(out.spf).toBe("fail");
    expect(out.dkim).toBe("neutral");
    expect(out.dmarc).toBe("fail");
  });

  it("falls back to Received-SPF when there is no Authentication-Results line", () => {
    const out = parseEmailHeaders(ONLY_RECEIVED_SPF);
    expect(out.spf).toBe("neutral");
    expect(out.dkim).toBe("unknown");
    expect(out.dmarc).toBe("unknown");
    expect(out.hadReceivedSpf).toBe(true);
    expect(out.hadAuthenticationResults).toBe(false);
  });

  it("unfolds continuation lines that start with whitespace (RFC 5322 §2.2.3)", () => {
    const out = parseEmailHeaders(HEADER_CONTINUATION);
    expect(out.spf).toBe("pass");
    expect(out.dkim).toBe("pass");
    expect(out.dmarc).toBe("pass");
  });

  it("returns all-unknown when no recognised headers are present", () => {
    const out = parseEmailHeaders(NO_AUTH_HEADERS);
    expect(out.spf).toBe("unknown");
    expect(out.dkim).toBe("unknown");
    expect(out.dmarc).toBe("unknown");
    expect(out.hadAuthenticationResults).toBe(false);
    expect(out.hadReceivedSpf).toBe(false);
  });

  it("handles empty or non-string input without throwing", () => {
    expect(parseEmailHeaders("").spf).toBe("unknown");
    expect(parseEmailHeaders("   ").spf).toBe("unknown");
    expect(parseEmailHeaders(null as unknown as string).spf).toBe("unknown");
  });

  it("keeps the FIRST occurrence per mechanism (no overwrite on duplicate)", () => {
    const conflicting = `
Authentication-Results: mx.gmail.com;
       spf=pass;
       spf=fail
`;
    expect(parseEmailHeaders(conflicting).spf).toBe("pass");
  });
});

describe("buildHeaderResult", () => {
  it("returns status=not_available for missing or empty input", () => {
    expect(buildHeaderResult(undefined).status).toBe("not_available");
    expect(buildHeaderResult("").status).toBe("not_available");
    expect(buildHeaderResult("   ").status).toBe("not_available");
  });

  it("returns status=not_available for headers with no SPF/DKIM/DMARC", () => {
    const result = buildHeaderResult(NO_AUTH_HEADERS);
    expect(result.status).toBe("not_available");
    expect(result.evidence.join(" ")).toMatch(/no SPF/i);
  });

  it("returns status=complete with all three mechanisms when present", () => {
    const result = buildHeaderResult(ALL_PASS);
    expect(result.status).toBe("complete");
    expect(result.spf).toBe("pass");
    expect(result.dkim).toBe("pass");
    expect(result.dmarc).toBe("pass");
    expect(result.evidence.length).toBeGreaterThan(0);
  });

  it("never defaults a missing mechanism to 'pass'", () => {
    const result = buildHeaderResult(ONLY_RECEIVED_SPF);
    expect(result.status).toBe("complete");
    expect(result.spf).toBe("neutral");
    expect(result.dkim).toBe("unknown");
    expect(result.dmarc).toBe("unknown");
  });

  it("caps evidence at 5 lines", () => {
    const noisy = Array.from({ length: 12 }, (_, i) =>
      `Authentication-Results: mx${i}.example; spf=pass`,
    ).join("\n");
    const result = buildHeaderResult(noisy);
    expect(result.evidence.length).toBeLessThanOrEqual(5);
  });
});
