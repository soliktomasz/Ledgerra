import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { MoreIcon } from "./icons";

export function ActionMenu({
  label,
  children,
  align = "end",
  triggerClassName = "",
  panelClassName = ""
}: {
  label: string;
  children: ReactNode;
  align?: "start" | "end";
  triggerClassName?: string;
  panelClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});
  const menuId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open) {
      return;
    }

    const updatePosition = () => {
      const trigger = triggerRef.current;
      const panel = panelRef.current;

      if (!trigger || !panel || typeof window === "undefined") {
        return;
      }

      const gap = 8;
      const triggerRect = trigger.getBoundingClientRect();
      const panelWidth = panel.offsetWidth;
      const panelHeight = panel.offsetHeight;
      let left = align === "start" ? triggerRect.left : triggerRect.right - panelWidth;
      left = Math.min(Math.max(gap, left), Math.max(gap, window.innerWidth - panelWidth - gap));

      let top = triggerRect.bottom + gap;
      const topAboveTrigger = triggerRect.top - panelHeight - gap;
      if (top + panelHeight > window.innerHeight - gap && topAboveTrigger >= gap) {
        top = topAboveTrigger;
      } else {
        top = Math.min(Math.max(gap, top), Math.max(gap, window.innerHeight - panelHeight - gap));
      }

      setPanelStyle({ left, top });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [align, children, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node) && !panelRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <>
      <div className={`action-menu${open ? " is-open" : ""}`} ref={containerRef}>
        <button
          ref={triggerRef}
          aria-controls={menuId}
          aria-expanded={open}
          aria-haspopup="true"
          aria-label={label}
          className={`ghost-button compact-button action-menu-trigger ${triggerClassName}`.trim()}
          onClick={() => setOpen((current) => !current)}
          title={label}
          type="button"
        >
          <MoreIcon />
        </button>
      </div>
      {open && typeof document !== "undefined"
        ? createPortal(
          <div
            ref={panelRef}
            className={`action-menu-panel action-menu-panel--${align} ${panelClassName}`.trim()}
            id={menuId}
            role="group"
            aria-label={label}
            style={panelStyle}
            onClick={(event) => {
              if ((event.target as HTMLElement).closest("button")) {
                setOpen(false);
              }
            }}
          >
            {children}
          </div>,
          document.body
        )
        : null}
    </>
  );
}
