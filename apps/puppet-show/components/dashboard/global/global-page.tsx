/**
 * Frame of the Superadmin "Sistema Global" pages: the page header with the
 * "Sistema Global" badge, then the page content. Containers draw it in every
 * state (access denied, loading, error, loaded) so the `<h1>` is always there.
 *
 * @module
 */

import type { ReactNode } from "react";
import { PageHeader } from "@/components/dashboard/page-header";

export type GlobalPageProps = {
  title: string;
  /** One or two sentences on what the page is for. */
  description: string;
  /** Extra classes for the outer column (e.g. a max width). */
  className?: string;
  children: ReactNode;
};

/** Header with the "Sistema Global" badge above the page content. */
export function GlobalPage({ title, description, className = "", children }: GlobalPageProps) {
  return (
    <div className={`column gap-[22px] ${className}`}>
      <PageHeader badge={{ label: "Sistema Global", tone: "info" }} title={title} description={description} />
      {children}
    </div>
  );
}
