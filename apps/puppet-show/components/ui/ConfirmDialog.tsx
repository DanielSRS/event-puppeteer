/**
 * Asks the person to confirm an action that is hard to undo (delete an event,
 * remove a user, shut a device down).
 *
 * Native `<dialog>` with `showModal()`: focus is trapped, the page behind is
 * inert and Escape cancels. The safe choice (cancel) gets the initial focus.
 *
 * Chrome may close a modal on Escape without firing `cancel` (when the page
 * had no user activation yet), so the `close` event is handled too: it cancels,
 * or reopens the dialog while `busy`.
 *
 * @module
 */

"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { ErrorAlert } from "./Feedback";

export type ConfirmDialogProps = {
  /** Whether the dialog is shown. */
  isOpen: boolean;
  /** Question in the heading, e.g. "Excluir este evento?". */
  title: string;
  /** What will happen, in plain words. */
  children: ReactNode;
  /** Label of the confirm button, e.g. "Sim, excluir". */
  confirmLabel: string;
  /** Styles the confirm button as destructive. */
  danger?: boolean;
  /** While true the buttons are disabled and the confirm button says it's working. */
  busy?: boolean;
  /** Why the last attempt failed; shown inside the dialog so the person can retry or cancel. */
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

/** A modal yes/no question. */
export function ConfirmDialog({
  isOpen, title, children, confirmLabel, danger = false, busy = false, error = "", onConfirm, onCancel,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const bodyId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (dialog === null) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  return (
    <dialog
      ref={ref}
      role="alertdialog"
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      onCancel={(event) => { event.preventDefault(); if (!busy) onCancel(); }}
      onClose={() => {
        // A `close` event is dispatched asynchronously: if the dialog was reopened meanwhile, it is stale.
        if (!isOpen || ref.current?.open) return;
        if (busy) ref.current?.showModal();
        else onCancel();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-3xl glass-strong text-foreground p-0 backdrop:bg-black/50 backdrop:backdrop-blur-sm"
    >
      {isOpen && (
        <div className="column gap-4 p-6">
          <h2 id={titleId} className="subtitle">{title}</h2>
          <div id={bodyId} className="text-sm text-foreground/80">{children}</div>

          <ErrorAlert>{error}</ErrorAlert>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" autoFocus onClick={onCancel} disabled={busy} className="button clean">
              Cancelar
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={busy}
              className={`button ${danger ? "danger" : "main"}`}
            >
              {busy ? "Aguarde..." : confirmLabel}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
