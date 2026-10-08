/**
 * Review of tags: free-form tags (created by people when publishing events)
 * wait as suggestions; a moderator promotes the ones that should become public
 * filters. The API can't reject or delete a tag, so there is no such button.
 *
 * @module
 */

import { MdArrowUpward, MdCheckCircle, MdLabel } from "react-icons/md";
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

/** Pending suggestions with a promote button, then the official tags. */
export function TagManager({ tags, busyTagId, onPromote }: TagManagerProps) {
  const pending = tags.filter((tag) => !tag.isSystemDefined).sort(ByName);
  const official = tags.filter((tag) => tag.isSystemDefined).sort(ByName);

  return (
    <div className="column gap-8">
      <section aria-labelledby="pending-tags-title" className="column gap-3">
        <h2 id="pending-tags-title" className="subtitle row gap-2">
          <MdLabel aria-hidden className="icon" /> Aguardando revisão ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="rounded-lg border border-dashed border-muted p-6 text-center text-sm text-foreground/70">
            Nenhuma tag sugerida aguardando revisão.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pending.map((tag) => (
              <li key={tag.id} className="card flex items-center justify-between gap-3">
                <span className="min-w-0 break-words font-medium text-main">#{tag.name}</span>
                <button
                  type="button"
                  disabled={busyTagId === tag.id}
                  onClick={() => onPromote(tag)}
                  className="button clean min-h-10 shrink-0"
                >
                  <MdArrowUpward aria-hidden className="icon" /> Promover<span className="sr-only"> a tag {tag.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="official-tags-title" className="column gap-3">
        <h2 id="official-tags-title" className="subtitle row gap-2">
          <MdCheckCircle aria-hidden className="icon text-success" /> Tags públicas ({official.length})
        </h2>
        {official.length === 0 ? (
          <p className="text-sm text-foreground/70">Nenhuma tag pública ainda.</p>
        ) : (
          <ul className="flex flex-wrap gap-2 rounded-lg border border-muted p-4">
            {official.map((tag) => (
              <li key={tag.id} className="rounded-full bg-success/10 px-3 py-1 text-sm font-medium text-success">#{tag.name}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
