import { describe, expect, it } from "vitest";
import { parseUrl } from "../../src/rules/parseUrl";
import { ipHostnameRule } from "../../src/rules/rules/ipHostname";

function evaluate(rawUrl: string) {
  return ipHostnameRule.evaluate(parseUrl(rawUrl));
}

describe("ipHostnameRule", () => {
  it("fires for IPv4 hostnames with a path", () => {
    const signal = evaluate("http://192.168.1.10/admin");
    expect(signal.fired).toBe(true);
    expect(signal.severity).toBe("high");
    expect(signal.score).toBeCloseTo(0.7);
    expect(signal.evidence).toMatchObject({ hostname: "192.168.1.10", ipVersion: "ipv4" });
  });

  it("fires for IPv4 hostnames with a port", () => {
    const signal = evaluate("http://203.0.113.5:8080/login");
    expect(signal.fired).toBe(true);
    expect(signal.evidence.ipVersion).toBe("ipv4");
  });

  it("fires for bracketed IPv6 hostnames", () => {
    const signal = evaluate("http://[2001:db8::1]/path");
    expect(signal.fired).toBe(true);
    expect(signal.evidence.ipVersion).toBe("ipv6");
  });

  it("fires for IPv6 with port", () => {
    const signal = evaluate("http://[2001:db8::1]:8443/x");
    expect(signal.fired).toBe(true);
    expect(signal.evidence.ipVersion).toBe("ipv6");
  });

  it("does not fire for a normal domain", () => {
    const signal = evaluate("https://www.example.com/path");
    expect(signal.fired).toBe(false);
    expect(signal.score).toBe(0);
    expect(signal.severity).toBe("info");
    expect(signal.evidence).toEqual({});
  });

  it("does not fire for a hostname containing digits but not an IP", () => {
    const signal = evaluate("https://store1.example.com/");
    expect(signal.fired).toBe(false);
  });

  it("does not fire for a hostname that looks IP-like but is not (5 octets)", () => {
    const signal = evaluate("https://1.2.3.4.5.example.com/");
    expect(signal.fired).toBe(false);
  });

  it("does not fire for malformed input", () => {
    const signal = evaluate("not a url");
    expect(signal.fired).toBe(false);
  });

  it("uses the documented default weight (0.70)", () => {
    expect(ipHostnameRule.defaultWeight).toBeCloseTo(0.7);
  });

  it("returns a stable signal id and layer", () => {
    const signal = evaluate("http://10.0.0.1/");
    expect(signal.id).toBe("ip_hostname");
    expect(signal.layer).toBe("rules");
  });
});
