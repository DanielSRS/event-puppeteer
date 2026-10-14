/**
 * The centered modal that holds the report form ("Denunciar evento"), with the
 * event's title under the heading and a close button.
 *
 * Built like the shared `Drawer`: a native `<dialog>` opened with
 * `showModal()`, so the browser traps focus, makes the page behind inert,
 * closes on Escape and returns focus to the button that opened it. A click on
 * the backdrop or Escape asks the parent via `onClose`, which may ignore it
 * (e.g. while sending). Chrome may close a modal on Escape without firing
 * `cancel`; the `close` event then reopens it and asks the parent.
 *
 * @module
 */

"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { MdClose } from "react-icons/md";

/** The dialog's heading; also its accessible name. */
export const REPORT_DIALOG_TITLE = "Denunciar evento";

export type ReportDialogProps = {
  isOpen: boolean;
  /** Called on Escape, the close button or a click on the backdrop. */
  onClose: () => void;
  /** The reported event's title, shown under the heading. */
  eventTitle: string;
  children: ReactNode;
};

/** A modal sheet centered on the page (a bottom sheet on phones). */
export function ReportDialog({ isOpen, onClose, eventTitle, children }: ReportDialogProps) {
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
        // A `close` event is dispatched asynchronously: if the dialog was reopened meanwhile, it is stale.
        if (!isOpen || ref.current?.open) return;
        ref.current?.showModal();
        onClose();
      }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
      className="glass-strong text-foreground mx-0 mb-0 mt-auto w-full max-w-full max-h-[92dvh] overflow-y-auto rounded-t-[30px] p-0 backdrop:bg-black/55 backdrop:backdrop-blur-[10px] sm:m-auto sm:max-w-[520px] sm:rounded-[30px]"
    >
      {isOpen && (
        <div className="column gap-[18px] p-[22px] sm:p-[26px]">
          <header className="flex items-start justify-between gap-3">
            <div className="column min-w-0 gap-1">
              <h2 id={titleId} className="h1 text-[26px] md:text-[28px]">{REPORT_DIALOG_TITLE}</h2>
              <p className="t2 break-words">{eventTitle}</p>
            </div>
            <button type="button" onClick={onClose} className="button icon-only focus-ring shrink-0" aria-label="Fechar">
              <MdClose aria-hidden className="icon" />
            </button>
          </header>

          {children}
        </div>
      )}
    </dialog>
  );
}
