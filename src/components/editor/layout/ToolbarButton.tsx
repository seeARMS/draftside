import type { ReactNode } from "react";
import { Button } from "../../ui/button";
import { cn } from "../../../lib/utils";
import type { TooltipPlacement } from "../hooks/useTooltip";

interface ToolbarButtonProps {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
  tooltipProps: (label: string, placement?: TooltipPlacement, size?: "wide") => Record<string, string | undefined>;
}

export function ToolbarButton({ label, active = false, disabled = false, onClick, children, tooltipProps }: ToolbarButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="iconSm"
      className={cn("text-muted-foreground", active && "bg-muted text-foreground")}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      {...tooltipProps(label, "bottom")}
    >
      {children}
    </Button>
  );
}
