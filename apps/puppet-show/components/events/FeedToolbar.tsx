/**
 * Search box and filter pills above the feed.
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
};

/** The fixed pills, before the tag pills. */
const GENERAL: ReadonlyArray<{ filter: FeedFilter; label: string; icon: ReactNode }> = [
  { filter: { kind: "all" }, label: "Todos", icon: null },
  { filter: { kind: "soonest" }, label: "Mais próximos", icon: <MdSchedule aria-hidden className="w-4 h-4" /> },
  { filter: { kind: "most-liked" }, label: "Mais curtidos", icon: <MdFavorite aria-hidden className="w-4 h-4" /> },
];

/**
 * Free-text search (title, description, location) and one row of pills:
 * "Todos", "Mais próximos", "Mais curtidos", then the tags. The pills scroll
 * sideways inside their own row on narrow screens.
 */
export function FeedToolbar({ query, filter, tags, onQueryChange, onFilterChange }: FeedToolbarProps) {
  const searchId = useId();

  return (
    <div className="column gap-3">
      <div className="column">
        <label htmlFor={searchId}>Buscar eventos</label>
        <div className="relative">
          <MdSearch aria-hidden className="icon absolute left-3 top-1/2 -translate-y-1/2 text-foreground/60" />
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Nome, descrição ou local"
            className="input pl-10 min-h-11"
          />
        </div>
      </div>

      <div role="group" aria-label="Filtrar eventos" className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
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

        {tags.length > 0 && <span aria-hidden className="w-px shrink-0 self-stretch bg-muted mx-1" />}

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
    </div>
  );
}
