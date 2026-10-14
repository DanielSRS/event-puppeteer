/**
 * Review of tags, in two glass panels: free-form tags (created by people when
 * publishing events) wait as dashed suggestion chips, each with a "Promover"
 * button for the ones that should become public filters; then the official
 * tags as plain chips. The API can't reject or delete a tag, so there is no
 * such button.
 *
 * @module
 */

import { MdArrowUpward } from "react-icons/md";
import type { Tag } from "@/lib/api/schemas";

export type TagManagerProps = {
  /** Every tag of the system, free-form and official. */
  tags: Tag[];
  /** Tag being promoted right now. */
  busyTagId: string | null;
  /** Asks to promote a free-form tag (the container confirms first). */
  onPromote: (tag: Tag) => void;
};

/** Sorts by name the Portuguese way. */
function ByName(a: Tag, b: Tag): number {
  return a.name.localeCompare(b.name, "pt-BR");
}

/** Panel title with a count bubble; screen readers hear "Title (n)". */
function PanelTitle({ id, title, count }: { id: string; title: string; count: number }) {
  return (
    <h2 id={id} className="h2 row gap-2.5 text-xl">
      {title} <span aria-hidden className="count count-n font-sans">{count}</span><span className="sr-only">({count})</span>
    </h2>
  );
}

/** Pending suggestions with a promote button, then the official tags. */
export function TagManager({ tags, busyTagId, onPromote }: TagManagerProps) {
  const pending = tags.filter((tag) => !tag.isSystemDefined).sort(ByName);
  const official = tags.filter((tag) => tag.isSystemDefined).sort(ByName);

  return (
    <div className="column gap-4">
      <section aria-labelledby="pending-tags-title" className="glass column gap-4 rounded-[26px] p-[22px]">
        <PanelTitle id="pending-tags-title" title="Aguardando revisão" count={pending.length} />
        {pending.length === 0 ? (
          <p className="t2">Nenhuma tag sugerida aguardando revisão.</p>
        ) : (
          <ul className="flex flex-wrap gap-2.5">
            {pending.map((tag) => (
              <li
                key={tag.id}
                className="surface inline-flex min-w-0 max-w-full items-center gap-1 rounded-full border border-dashed border-[var(--line-2)] py-1 pl-4 pr-1"
              >
                <span className="min-w-0 break-words font-medium">#{tag.name}</span>
                <button
                  type="button"
                  disabled={busyTagId === tag.id}
                  onClick={() => onPromote(tag)}
                  className="focus-ring inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-[var(--surface-2)] px-3.5 font-semibold text-foreground transition-colors enabled:hover:bg-[var(--accent)] enabled:hover:text-[color:var(--on-accent)] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <MdArrowUpward aria-hidden className="h-[15px] w-[15px]" /> Promover<span className="sr-only"> a tag {tag.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="t3 text-[13px]">Promover não pode ser desfeito. Não há como recusar uma sugestão: ela apenas continua oculta.</p>
      </section>

      <section aria-labelledby="official-tags-title" className="glass column gap-4 rounded-[26px] p-[22px]">
        <PanelTitle id="official-tags-title" title="Tags públicas" count={official.length} />
        {official.length === 0 ? (
          <p className="t2">Nenhuma tag pública ainda.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {official.map((tag) => (
              <li key={tag.id} className="chip px-4 py-2 text-sm text-foreground">{tag.name}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
