import * as React from "react";
import { cn } from "../../lib/utils";

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number | null;
}

function Progress({ value, className, ...props }: ProgressProps) {
  const percent = value === null ? 12 : Math.max(0, Math.min(100, Math.round(value * 100)));

  return (
    <div className={cn("h-1.5 overflow-hidden rounded-full bg-muted", className)} {...props}>
      <div className="h-full rounded-full bg-foreground transition-[width] duration-200 ease-out" style={{ width: `${percent}%` }} />
    </div>
  );
}

export { Progress };
