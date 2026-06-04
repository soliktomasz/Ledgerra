import { useEffect, useId, useRef, useState, type ReactNode } from "react";
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
  const menuId = useId();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
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
    <div className={`action-menu${open ? " is-open" : ""}`} ref={containerRef}>
      <button
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
      {open ? (
        <div
          className={`action-menu-panel action-menu-panel--${align} ${panelClassName}`.trim()}
          id={menuId}
          role="group"
          aria-label={label}
          onClick={(event) => {
            if ((event.target as HTMLElement).closest("button")) {
              setOpen(false);
            }
          }}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
