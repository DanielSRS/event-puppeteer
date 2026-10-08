/**
 * What a dashboard page shows instead of its content when the person can't
 * open it in the current context (see {@link SectionDenialFor}). The page
 * never gets to call the API, so the person sees why instead of an API error.
 *
 * @module
 */

import Link from "next/link";
import type { SectionDenial } from "./DashboardSections";

/** Props of {@link AccessDeniedNotice}. */
export type AccessDeniedNoticeProps = {
  /** Why the page can't be opened. */
  denial: SectionDenial;
  /** First section the person can open, offered as a way out; `null` when there is none. */
  firstSection: { label: string; href: string } | null;
};

/** Text for each reason. */
const MESSAGES: Record<SectionDenial, string> = {
  "role": "Você não tem permissão para acessar esta página.",
  "needs-org": "Esta página pertence a uma organização. Selecione uma organização no seletor de contexto para vê-la.",
  "needs-global": "Esta página pertence ao Sistema Global. Selecione \"Sistema Global\" no seletor de contexto para vê-la.",
};

/** Explains why the page is unavailable and links to a page that is. */
export function AccessDeniedNotice({ denial, firstSection }: AccessDeniedNoticeProps) {
  return (
    <section aria-labelledby="access-denied-title" className="card column gap-3">
      <h1 id="access-denied-title" className="subtitle">Página indisponível</h1>
      <p>{MESSAGES[denial]}</p>
      {firstSection !== null && (
        <Link href={firstSection.href} className="button clean min-h-10 self-start">
          Ir para {firstSection.label}
        </Link>
      )}
    </section>
  );
}
