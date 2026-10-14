/**
 * Small pieces shared by the event card, the details page and the TV display:
 * the calendar badge, the like button and the tag chips.
 *
 * @module
 */

import { MdEvent, MdFavorite, MdFavoriteBorder } from "react-icons/md";
import { DateBadge as BadgeParts } from "@/domain/schedule";
import type { CardTag } from "@/domain/feed";

export type DateBadgeProps = {
  /** `YYYY-MM-DD`, or `null` for an event without days. */
  date: string | null;
  /** `"lg"` for the TV display. */
  size?: "md" | "lg";
};

/** Day and short month in a block, like a desk calendar. */
export function DateBadge({ date, size = "md" }: DateBadgeProps) {
  const parts = date === null ? null : BadgeParts(date);
  const box = size === "lg" ? "w-24 h-24" : "w-16 h-16";

  if (parts === null) {
    return (
      <div className={`center ${box} shrink-0 rounded-lg bg-main/15 text-main`} role="img" aria-label="Sem data definida">
        <MdEvent aria-hidden className="w-8 h-8" />
      </div>
    );
  }

  return (
    <div className={`column center ${box} shrink-0 rounded-2xl bg-accent text-on-accent`} aria-hidden>
      <span className={`${size === "lg" ? "text-4xl" : "text-2xl"} font-bold leading-none`}>{parts.day}</span>
      <span className={`${size === "lg" ? "text-lg" : "text-sm"} uppercase font-semibold`}>{parts.month}</span>
    </div>
  );
}

export type LikeButtonProps = {
  /** The event's title, so the button's name says which event it is. */
  title: string;
  voted: boolean;
  count: number;
  /** While the vote request runs the button waits. */
  busy?: boolean;
  onToggle: () => void;
  /** Extra classes for where the button sits (on a photo, stacked in a grid…). */
  className?: string;
};

/** `"1 curtida"` / `"3 curtidas"`. */
export function LikesLabel(count: number): string {
  return `${count} ${count === 1 ? "curtida" : "curtidas"}`;
}

/** The design's fixed "liked" pink; only the heart takes it, so the counter keeps the text contrast. */
const LIKED_PINK = "#FF6B8A";

/**
 * Heart toggle with the live counter; `aria-pressed` tells whether the viewer
 * liked it (the heart fills in pink). Its name reads "Curtir “Título”, 3 curtidas"
 * (the number is the visible part, so speech commands like "click 3" work too).
 */
export function LikeButton({ title, voted, count, busy = false, onToggle, className = "" }: LikeButtonProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={busy}
      aria-pressed={voted}
      aria-busy={busy}
      className={`button touch focus-ring font-semibold ${className}`}
    >
      {voted
        ? <MdFavorite aria-hidden className="icon shrink-0" style={{ color: LIKED_PINK }} />
        : <MdFavoriteBorder aria-hidden className="icon shrink-0" />}
      <span>
        <span className="sr-only">Curtir “{title}”,</span>
        <span className="font-mono tabular-nums">{count}</span>
        <span className="sr-only">{count === 1 ? "curtida" : "curtidas"}</span>
      </span>
    </button>
  );
}

export type TagChipsProps = {
  tags: CardTag[];
};

/** The event's public tags as a list of chips; nothing when there are none. */
export function TagChips({ tags }: TagChipsProps) {
  if (tags.length === 0) return null;
  return (
    <ul aria-label="Categorias" className="flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <li key={tag.id} className="chip">{tag.name}</li>
      ))}
    </ul>
  );
}
