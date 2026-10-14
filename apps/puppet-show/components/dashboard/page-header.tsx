/**
 * Heading block at the top of every dashboard page: an optional badge naming
 * the area, the page title, a short description and the page's main actions.
 *
 * @module
 */

import type { ReactNode } from "react";

/** Color of the area badge. */
export type BadgeTone = "ok" | "bad" | "warn" | "info" | "violet" | "neutral";

export type PageHeaderProps = {
  title: string;
  /** One or two sentences on what the page is for. */
  description?: ReactNode;
  /** Small badge above the title (e.g. "Sistema Global", "Moderação"). */
  badge?: { label: string; tone: BadgeTone };
  /** Buttons on the right (stacked under the text on narrow screens). */
  actions?: ReactNode;
};

/** Badge, h1, description and actions, wrapping on narrow screens. */
export function PageHeader({ title, description, badge, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="column max-w-[64ch] gap-1.5">
        {badge !== undefined && <span className={`badge b-${badge.tone} self-start`}>{badge.label}</span>}
        <h1 className="h1">{title}</h1>
        {description !== undefined && <p className="t2 text-[15px]">{description}</p>}
      </div>
      {actions !== undefined && <div className="flex flex-wrap gap-2 max-sm:w-full max-sm:[&>*]:flex-1">{actions}</div>}
    </header>
  );
}
