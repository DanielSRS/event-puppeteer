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
    <p role="alert" className={`notice n-bad ${className}`}>
      <MdErrorOutline aria-hidden className="mt-px h-[18px] w-[18px] shrink-0" />
      <span>{children}</span>
    </p>
  );
}

/** A confirmation that something worked (`role="status"`). */
export function StatusMessage({ children, className = "" }: FeedbackProps) {
  if (!children) return null;

  return (
    <p role="status" className={`notice n-ok ${className}`}>
      <MdCheckCircle aria-hidden className="mt-px h-[18px] w-[18px] shrink-0" />
      <span>{children}</span>
    </p>
  );
}

/** Shown while data loads (`role="status"`, so it is announced). */
export function LoadingMessage({ children, className = "" }: FeedbackProps) {
  return (
    <p role="status" aria-busy="true" className={`t3 p-8 text-center animate-pulse ${className}`}>
      {children}
    </p>
  );
}
