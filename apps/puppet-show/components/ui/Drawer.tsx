/**
 * Side panel for forms (create organization, report an event, approve a device…).
 *
 * Built on the native `<dialog>` opened with `showModal()`, so the browser
 * traps focus inside it, makes the page behind inert, closes it on Escape and
 * returns focus to whatever opened it. On phones it takes the whole width;
 * `placement="bottom"` turns it into a bottom sheet.
 *
 * Chrome may close a modal on Escape without firing `cancel` (when the page
 * had no user activation yet); the `close` event then reopens the panel and
 * asks the parent via `onClose`, so the parent stays in charge.
 *
 * @module
 */

"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { MdClose } from "react-icons/md";

export type DrawerProps = {
  /** Whether the panel is shown. */
  isOpen: boolean;
  /** Called on Escape, the close button or a click on the backdrop. Ignore it to keep the panel open (e.g. while saving). */
  onClose: () => void;
  /** Heading of the panel; also its accessible name. */
  title: string;
  children: ReactNode;
  /** Maximum width on larger screens. */
  width?: "md" | "lg" | "xl";
  /** "side" slides from the right; "bottom" is a sheet from the bottom edge (phone menus). */
  placement?: "side" | "bottom";
};

const WIDTHS = {
  md: "sm:max-w-md",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-4xl",
} as const;

/** A modal side panel with a title and a close button. */
export function Drawer({ isOpen, onClose, title, children, width = "md", placement = "side" }: DrawerProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (dialog === null) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClose={() => {
        if (!isOpen) return;
        ref.current?.showModal();
        onClose();
      }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
      className={`glass-strong text-foreground p-0 backdrop:bg-black/50 backdrop:backdrop-blur-sm ${
        placement === "bottom"
          ? "mx-0 mb-0 mt-auto w-full max-w-full max-h-[88dvh] rounded-t-3xl"
          : `m-0 ml-auto h-dvh max-h-dvh w-full ${WIDTHS[width]} sm:rounded-l-3xl`
      }`}
    >
      {isOpen && (
        <div className={`column ${placement === "bottom" ? "max-h-[88dvh]" : "h-full"}`}>
          {placement === "bottom" && <span aria-hidden className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-foreground/25" />}
          <header className="between gap-2 px-5 py-4 border-b border-muted">
            <h2 id={titleId} className="font-display text-xl font-bold tracking-tight">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="center touch rounded-full hover:bg-foreground/8 transition-colors focus-ring"
              aria-label="Fechar"
            >
              <MdClose aria-hidden className="icon" />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto p-5">
            {children}
          </div>
        </div>
      )}
    </dialog>
  );
}
