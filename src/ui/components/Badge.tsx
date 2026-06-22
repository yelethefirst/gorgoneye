import type { ReactNode } from "react";
import type { Verdict } from "../../shared/verdict";
import { cn } from "./cn";

export interface BadgeProps {
  verdict: Verdict;
  size?: "sm" | "md";
  children?: ReactNode;
  className?: string;
  /** Optional override for the accessible label (defaults to "Verdict: <verdict>"). */
  ariaLabel?: string;
}

const VERDICT_COLOR: Record<Verdict, string> = {
  safe: "bg-verdict-safe-soft text-verdict-safe ring-verdict-safe/30",
  suspicious:
    "bg-verdict-suspicious-soft text-verdict-suspicious ring-verdict-suspicious/30",
  phishing: "bg-verdict-phishing-soft text-verdict-phishing ring-verdict-phishing/30",
  unknown: "bg-verdict-unknown-soft text-verdict-unknown ring-verdict-unknown/30",
};

const VERDICT_LABEL: Record<Verdict, string> = {
  safe: "Safe",
  suspicious: "Suspicious",
  phishing: "Phishing",
  unknown: "Unknown",
};

const SIZE = {
  sm: "px-1.5 py-0.5 text-2xs",
  md: "px-2 py-0.5 text-xs",
};

export function Badge({ verdict, size = "md", children, className, ariaLabel }: BadgeProps) {
  return (
    <span
      role="status"
      aria-label={ariaLabel ?? `Verdict: ${VERDICT_LABEL[verdict]}`}
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-semibold uppercase tracking-wide ring-1 ring-inset",
        SIZE[size],
        VERDICT_COLOR[verdict],
        className,
      )}
    >
      <span aria-hidden="true" className="inline-block size-1.5 rounded-full bg-current" />
      {children ?? VERDICT_LABEL[verdict]}
    </span>
  );
}
