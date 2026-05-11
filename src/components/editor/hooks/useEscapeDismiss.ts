import { useEffect } from "react";

export function useEscapeDismiss(active: boolean, onDismiss: () => void) {
  useEffect(() => {
    if (!active) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDismiss();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [active, onDismiss]);
}

export function usePointerDownOutside(active: boolean, ref: React.RefObject<HTMLElement | null>, onOutside: () => void) {
  useEffect(() => {
    if (!active) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) onOutside();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [active, onOutside, ref]);
}
