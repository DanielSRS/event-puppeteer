/**
 * Search box and filter pills above the feed, in one glass bar.
 *
 * @module
 */

import { useId, type ReactNode } from "react";
import { MdFavorite, MdSearch, MdSchedule } from "react-icons/md";
import { SameFilter, type CardTag, type FeedFilter } from "@/domain/feed";

export type FeedToolbarProps = {
  query: string;
  filter: FeedFilter;
  /** One pill per public tag present in the feed. */
  tags: CardTag[];
  onQueryChange: (query: string) => void;
  onFilterChange: (filter: FeedFilter) => void;
  /** Shown at the end of the bar (e.g. how fresh the feed is). */
  trailing?: ReactNode;
};

/** The fixed pills, before the tag pills. */
const GENERAL: ReadonlyArray<{ filter: FeedFilter; label: string; icon: ReactNode }> = [
  { filter: { kind: "all" }, label: "Todos", icon: null },
  { filter: { kind: "soonest" }, label: "Mais próximos", icon: <MdSchedule aria-hidden className="w-4 h-4" /> },
  { filter: { kind: "most-liked" }, label: "Mais curtidos", icon: <MdFavorite aria-hidden className="w-4 h-4" /> },
];

/**
 * Free-text search (title, description, location) and one group of pills:
 * "Todos", "Mais próximos", "Mais curtidos", then the tags. The search label
 * is visually hidden (the icon and placeholder say it). The pills wrap on
 * wide screens and scroll sideways inside their own row on phones.
 */
export function FeedToolbar({ query, filter, tags, onQueryChange, onFilterChange, trailing }: FeedToolbarProps) {
  const searchId = useId();

  return (
    <section aria-label="Busca e filtros" className="glass flex flex-wrap items-center gap-3 rounded-[22px] p-2.5">
      <div className="relative min-w-0 flex-[1_1_260px]">
        <label htmlFor={searchId} className="sr-only">Buscar eventos</label>
        <MdSearch aria-hidden className="icon t3 pointer-events-none absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          id={searchId}
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Buscar por nome, descrição ou local"
          className="input pl-12"
        />
      </div>

      <div
        role="group"
        aria-label="Filtrar eventos"
        className="-mx-2.5 -my-1 flex min-w-0 flex-[999_1_540px] gap-1.5 overflow-x-auto px-2.5 py-1 [scrollbar-width:none] sm:mx-0 sm:my-0 sm:py-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {GENERAL.map((option) => (
          <button
            key={option.label}
            type="button"
            className="pill focus-ring"
            aria-pressed={SameFilter(filter, option.filter)}
            onClick={() => onFilterChange(option.filter)}
          >
            {option.icon}
            {option.label}
          </button>
        ))}

        {tags.length > 0 && <span aria-hidden className="mx-1 w-px shrink-0 self-stretch bg-muted" />}

        {tags.map((tag) => {
          const tagFilter: FeedFilter = { kind: "tag", tagId: tag.id };
          return (
            <button
              key={tag.id}
              type="button"
              className="pill focus-ring"
              aria-pressed={SameFilter(filter, tagFilter)}
              onClick={() => onFilterChange(tagFilter)}
            >
              {tag.name}
            </button>
          );
        })}
      </div>

      {trailing !== undefined && <div className="ml-auto px-2">{trailing}</div>}
    </section>
  );
}
