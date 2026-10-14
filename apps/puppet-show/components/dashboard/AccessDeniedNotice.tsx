/**
 * What a dashboard page shows instead of its content when the person can't
 * open it in the current context (see {@link SectionDenialFor}). The page
 * never gets to call the API, so the person sees why instead of an API error.
 * Drawn as a glass panel with an icon tile, the page's `<h1>` and the way out.
 *
 * @module
 */

import Link from "next/link";
import { MdArrowForward, MdBlock, MdDomain, MdPublic } from "react-icons/md";
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

/** Icon and tone of the tile for each reason: a refusal is red, a wrong context is informative. */
const TILES: Record<SectionDenial, { icon: typeof MdBlock; className: string }> = {
  "role": { icon: MdBlock, className: "c-bad bg-[var(--bad-bg)]" },
  "needs-org": { icon: MdDomain, className: "c-info bg-[var(--info-bg)]" },
  "needs-global": { icon: MdPublic, className: "c-info bg-[var(--info-bg)]" },
};

/** Explains why the page is unavailable and links to a page that is. */
export function AccessDeniedNotice({ denial, firstSection }: AccessDeniedNoticeProps) {
  const tile = TILES[denial];
  const Icon = tile.icon;
  return (
    <section aria-labelledby="access-denied-title" className="glass column max-w-2xl items-start gap-4 rounded-[26px] p-6 sm:p-8">
      <span aria-hidden className={`grid h-12 w-12 place-items-center rounded-2xl ${tile.className}`}>
        <Icon className="h-6 w-6" />
      </span>
      <div className="column gap-1.5">
        <h1 id="access-denied-title" className="h2">Página indisponível</h1>
        <p className="t2 text-[15px]">{MESSAGES[denial]}</p>
      </div>
      {firstSection !== null && (
        <Link href={firstSection.href} className="button focus-ring max-sm:w-full">
          Ir para {firstSection.label}
          <MdArrowForward aria-hidden className="h-[18px] w-[18px]" />
        </Link>
      )}
    </section>
  );
}
