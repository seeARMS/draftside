import { useEffect, type ReactNode } from "react";
import { cn } from "../../lib/utils";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  side?: "left" | "right";
  ariaLabel?: string;
  className?: string;
  children: ReactNode;
}

export function Drawer({ open, onClose, side = "left", ariaLabel, className, children }: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-0 z-[70]",
        open && "pointer-events-auto",
      )}
      aria-hidden={!open}
    >
      <button
        type="button"
        aria-label="Close"
        tabIndex={open ? 0 : -1}
        onClick={onClose}
        className={cn(
          "absolute inset-0 cursor-default bg-background/40 backdrop-blur-sm opacity-0 transition-opacity duration-200 ease-out",
          open && "opacity-100",
        )}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        className={cn(
          "absolute top-0 bottom-0 flex w-[min(20rem,calc(100vw-3rem))] flex-col bg-card text-card-foreground shadow-[0_24px_78px_hsl(var(--foreground)/0.22)] transition-transform duration-200 ease-out [&>*]:!rounded-none [&>*]:!outline-0 [&>*]:flex-1 [&>*]:min-h-0",
          side === "left" ? "left-0 -translate-x-full" : "right-0 translate-x-full",
          open && "translate-x-0",
          className,
        )}
      >
        {children}
      </aside>
    </div>
  );
}
