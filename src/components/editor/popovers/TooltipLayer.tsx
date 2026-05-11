import type { CSSProperties } from "react";
import type { ActiveTooltip } from "../hooks/useTooltip";

interface TooltipLayerProps {
  activeTooltip: ActiveTooltip | null;
}

export function TooltipLayer({ activeTooltip }: TooltipLayerProps) {
  if (!activeTooltip) return null;

  const className = ["editor-tooltip", `is-${activeTooltip.placement}`, activeTooltip.size ? `is-${activeTooltip.size}` : ""]
    .filter(Boolean)
    .join(" ");

  const style = {
    "--tooltip-x": `${activeTooltip.x}px`,
    "--tooltip-y": `${activeTooltip.y}px`,
  } as CSSProperties;

  return (
    <div className={className} role="tooltip" style={style}>
      {activeTooltip.label}
    </div>
  );
}
