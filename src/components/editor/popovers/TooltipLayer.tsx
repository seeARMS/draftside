import type { CSSProperties } from "react";
import type { ActiveTooltip } from "../hooks/useTooltip";
import { cn } from "../../../lib/utils";

interface TooltipLayerProps {
  activeTooltip: ActiveTooltip | null;
}

export function TooltipLayer({ activeTooltip }: TooltipLayerProps) {
  if (!activeTooltip) return null;

  const className = cn(
    "pointer-events-none fixed z-[1000] block w-max max-w-[min(14rem,calc(100vw-1rem))] whitespace-normal rounded-md bg-foreground px-2 py-1.5 text-center text-xs font-semibold leading-4 text-background shadow-[0_10px_28px_hsl(var(--foreground)/0.16)]",
    activeTooltip.size === "wide" && "max-w-[min(18rem,calc(100vw-1rem))] text-left font-medium leading-[1.15rem]",
    activeTooltip.placement === "top" && "-translate-x-1/2 translate-y-[calc(-100%-0.5rem)]",
    activeTooltip.placement === "right" && "translate-x-2 -translate-y-1/2",
    activeTooltip.placement === "bottom" && "-translate-x-1/2 translate-y-2",
    activeTooltip.placement === "left" && "translate-x-[calc(-100%-0.5rem)] -translate-y-1/2",
  );

  const useHorizontalClamp = activeTooltip.placement === "top" || activeTooltip.placement === "bottom";
  const clampEdge = activeTooltip.size === "wide" ? "9.5rem" : "7.5rem";
  const style = {
    top: `${activeTooltip.y}px`,
    left: useHorizontalClamp ? `clamp(${clampEdge}, ${activeTooltip.x}px, calc(100vw - ${clampEdge}))` : `${activeTooltip.x}px`,
  } as CSSProperties;

  return (
    <div className={className} role="tooltip" style={style}>
      {activeTooltip.label}
    </div>
  );
}
