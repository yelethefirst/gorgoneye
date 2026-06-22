import { useId, useState, type ReactNode } from "react";
import { cn } from "./cn";

export interface TooltipProps {
  /** The text shown in the tooltip. Keep short. */
  content: ReactNode;
  /** The element that receives focus/hover. */
  children: ReactNode;
  side?: "top" | "bottom";
  className?: string;
}

/**
 * Minimal hover/focus tooltip. Uses aria-describedby so screen readers see the
 * text. Intentionally CSS-only positioning to avoid pulling in a popper library.
 */
export function Tooltip({ content, children, side = "top", className }: TooltipProps) {
  const id = useId();
  const [open, setOpen] = useState(false);

  return (
    <span className={cn("relative inline-flex", className)}>
      <span
        aria-describedby={open ? id : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        tabIndex={0}
        className="inline-flex"
      >
        {children}
      </span>
      <span
        id={id}
        role="tooltip"
        hidden={!open}
        className={cn(
          "pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 whitespace-nowrap " +
            "rounded bg-text-primary px-2 py-1 text-2xs text-white shadow-md",
          side === "top" ? "bottom-full mb-1" : "top-full mt-1",
        )}
      >
        {content}
      </span>
    </span>
  );
}
