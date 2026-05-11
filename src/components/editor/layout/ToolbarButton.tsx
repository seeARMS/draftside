import type { ReactNode } from "react";
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
    <button
      type="button"
      className={active ? "tool-button is-active" : "tool-button"}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      {...tooltipProps(label, "bottom")}
    >
      {children}
    </button>
  );
}
