import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export interface PanelProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
}

export function Panel({ title, description, children, className, ...rest }: PanelProps) {
  return (
    <section
      className={cn(
        "rounded-lg border border-surface-border bg-surface p-3 shadow-xs",
        className,
      )}
      {...rest}
    >
      {(title || description) && (
        <header className="mb-2">
          {title && <h2 className="text-sm font-semibold text-text-primary">{title}</h2>}
          {description && (
            <p className="mt-0.5 text-xs text-text-secondary">{description}</p>
          )}
        </header>
      )}
      <div className="text-sm text-text-primary">{children}</div>
    </section>
  );
}
