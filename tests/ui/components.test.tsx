import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  Badge,
  Button,
  Panel,
  ProgressBar,
  Toggle,
  Tooltip,
} from "../../src/ui/components";

function render(node: React.ReactElement): string {
  return renderToStaticMarkup(node);
}

describe("Button", () => {
  it("renders children and defaults to type=button", () => {
    const html = render(<Button>Scan</Button>);
    expect(html).toContain(">Scan<");
    expect(html).toContain('type="button"');
  });

  it("respects the disabled prop", () => {
    const html = render(<Button disabled>Save</Button>);
    expect(html).toContain("disabled");
  });

  it("applies variant classes (primary uses accent)", () => {
    const html = render(<Button variant="primary">Go</Button>);
    expect(html).toContain("bg-accent");
  });
});

describe("Badge", () => {
  it.each(["safe", "suspicious", "phishing", "unknown"] as const)(
    "renders the %s verdict with the correct accessible label",
    (verdict) => {
      const html = render(<Badge verdict={verdict} />);
      expect(html).toContain(`Verdict: ${verdict.charAt(0).toUpperCase() + verdict.slice(1)}`);
      expect(html).toContain(`role="status"`);
    },
  );

  it("supports a custom child label and ariaLabel override", () => {
    const html = render(
      <Badge verdict="phishing" ariaLabel="High-confidence phishing">
        Blocked
      </Badge>,
    );
    expect(html).toContain("Blocked");
    expect(html).toContain("High-confidence phishing");
  });
});

describe("ProgressBar", () => {
  it("exposes ARIA progressbar attributes", () => {
    const html = render(<ProgressBar value={0.42} verdict="suspicious" />);
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuemin="0"');
    expect(html).toContain('aria-valuemax="100"');
    expect(html).toContain('aria-valuenow="42"');
  });

  it("clamps values outside [0, 1]", () => {
    const high = render(<ProgressBar value={3.0} />);
    expect(high).toContain('aria-valuenow="100"');
    const low = render(<ProgressBar value={-1} />);
    expect(low).toContain('aria-valuenow="0"');
  });

  it("handles non-finite values without crashing", () => {
    const html = render(<ProgressBar value={NaN} />);
    expect(html).toContain('aria-valuenow="0"');
  });
});

describe("Toggle", () => {
  it("renders as role=switch with aria-checked", () => {
    const html = render(
      <Toggle checked={true} onChange={() => {}} label="Rules layer" />,
    );
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-checked="true"');
  });

  it("marks disabled state on both label and switch", () => {
    const html = render(
      <Toggle checked={false} onChange={() => {}} label="ML" disabled />,
    );
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain("disabled");
  });
});

describe("Tooltip", () => {
  it("renders the trigger and hides the tooltip body by default", () => {
    const html = render(
      <Tooltip content="More info">
        <span>Hover me</span>
      </Tooltip>,
    );
    expect(html).toContain("Hover me");
    expect(html).toContain('role="tooltip"');
    expect(html).toContain("hidden");
  });
});

describe("Panel", () => {
  it("renders a heading when a title is provided", () => {
    const html = render(
      <Panel title="Recent verdicts" description="Last 10">
        <div>body</div>
      </Panel>,
    );
    expect(html).toContain("Recent verdicts");
    expect(html).toContain("Last 10");
    expect(html).toContain("<h2");
  });

  it("renders without a header when no title or description is provided", () => {
    const html = render(
      <Panel>
        <p>body only</p>
      </Panel>,
    );
    expect(html).toContain("body only");
    expect(html).not.toContain("<h2");
  });
});
