import { useCallback, useEffect, useRef, useState } from "react";

export type TooltipPlacement = "top" | "right" | "bottom" | "left";

export interface ActiveTooltip {
  label: string;
  placement: TooltipPlacement;
  size?: "wide";
  x: number;
  y: number;
}

export type TooltipPropsResult = Record<string, string | undefined>;

export function useTooltip() {
  const [activeTooltip, setActiveTooltip] = useState<ActiveTooltip | null>(null);
  const tooltipTargetRef = useRef<HTMLElement | null>(null);

  const tooltipProps = useCallback(
    (label: string, placement: TooltipPlacement = "top", size?: "wide"): TooltipPropsResult => ({
      "data-tooltip": label,
      "data-tooltip-placement": placement,
      ...(size ? { "data-tooltip-size": size } : {}),
    }),
    [],
  );

  const showTooltipForElement = useCallback((element: HTMLElement) => {
    const label = element.dataset.tooltip;
    if (!label) return;

    let placement = (element.dataset.tooltipPlacement as TooltipPlacement | undefined) ?? "top";
    const size = element.dataset.tooltipSize === "wide" ? "wide" : undefined;
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const isCompactViewport = typeof window !== "undefined" && window.innerWidth <= 520;
    if (isCompactViewport && (placement === "left" || placement === "right")) {
      placement = rect.top < window.innerHeight / 2 ? "bottom" : "top";
    }

    setActiveTooltip({
      label,
      placement,
      size,
      x: placement === "left" ? rect.left : placement === "right" ? rect.right : centerX,
      y: placement === "top" ? rect.top : placement === "bottom" ? rect.bottom : centerY,
    });
  }, []);

  const hideTooltip = useCallback(() => {
    tooltipTargetRef.current = null;
    setActiveTooltip(null);
  }, []);

  const handlePointerOver = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-tooltip]") : null;
      if (!target || !event.currentTarget.contains(target)) return;

      tooltipTargetRef.current = target;
      showTooltipForElement(target);
    },
    [showTooltipForElement],
  );

  const handlePointerOut = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const current = tooltipTargetRef.current;
      const next = event.relatedTarget as Node | null;
      if (current && next && current.contains(next)) return;
      hideTooltip();
    },
    [hideTooltip],
  );

  const handleFocus = useCallback(
    (event: React.FocusEvent<HTMLDivElement>) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-tooltip]") : null;
      if (!target || !event.currentTarget.contains(target)) return;

      tooltipTargetRef.current = target;
      showTooltipForElement(target);
    },
    [showTooltipForElement],
  );

  const handleBlur = useCallback(
    (event: React.FocusEvent<HTMLDivElement>) => {
      const current = tooltipTargetRef.current;
      const next = event.relatedTarget as Node | null;
      if (current && next && current.contains(next)) return;
      hideTooltip();
    },
    [hideTooltip],
  );

  useEffect(() => {
    if (!activeTooltip) return;

    const updateTooltipPosition = () => {
      const target = tooltipTargetRef.current;
      if (!target?.isConnected) {
        hideTooltip();
        return;
      }
      showTooltipForElement(target);
    };

    window.addEventListener("resize", updateTooltipPosition);
    window.addEventListener("scroll", updateTooltipPosition, true);
    return () => {
      window.removeEventListener("resize", updateTooltipPosition);
      window.removeEventListener("scroll", updateTooltipPosition, true);
    };
  }, [activeTooltip, hideTooltip, showTooltipForElement]);

  return {
    activeTooltip,
    tooltipProps,
    hideTooltip,
    handlePointerOver,
    handlePointerOut,
    handleFocus,
    handleBlur,
  };
}
