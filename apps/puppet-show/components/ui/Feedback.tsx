/**
 * Messages that tell the person what happened.
 *
 * Every failure in the app ends up in an {@link ErrorAlert}, announced to
 * screen readers immediately; confirmations go in a {@link StatusMessage},
 * announced politely. Loading states use {@link LoadingMessage}.
 *
 * @module
 */

import type { ReactNode } from "react";
import { MdCheckCircle, MdErrorOutline } from "react-icons/md";

/** Props shared by the feedback messages. */
type FeedbackProps = {
  /** What to say. Nothing is rendered when it is empty. */
  children: ReactNode;
  /** Extra classes for spacing in the parent layout. */
  className?: string;
};

/** An error the person must see (`role="alert"`). */
export function ErrorAlert({ children, className = "" }: FeedbackProps) {
  if (!children) return null;

  return (
    <p role="alert" className={`row items-start gap-2 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger ${className}`}>
      <MdErrorOutline aria-hidden className="icon shrink-0" />
      <span>{children}</span>
    </p>
  );
}

/** A confirmation that something worked (`role="status"`). */
export function StatusMessage({ children, className = "" }: FeedbackProps) {
  if (!children) return null;

  return (
    <p role="status" className={`row items-start gap-2 rounded-lg border border-success/40 bg-success/10 p-3 text-sm text-success ${className}`}>
      <MdCheckCircle aria-hidden className="icon shrink-0" />
      <span>{children}</span>
    </p>
  );
}

/** Shown while data loads (`role="status"`, so it is announced). */
export function LoadingMessage({ children, className = "" }: FeedbackProps) {
  return (
    <p role="status" aria-busy="true" className={`p-8 text-center text-foreground/60 animate-pulse ${className}`}>
      {children}
    </p>
  );
}
