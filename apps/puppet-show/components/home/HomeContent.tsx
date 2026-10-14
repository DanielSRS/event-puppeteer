/**
 * The home page: the public feed people browse, like and filter.
 *
 * On top, the most liked event of the week as a photo hero beside the
 * "Próximos 7 dias" rail (with the QR code; large screens only); then the
 * glass search-and-filter bar with how fresh the feed is; then the cards.
 *
 * @module
 */

"use client";

import { useMemo, useState } from "react";
import { EventList } from "@/components/events/EventList";
import { FeedToolbar } from "@/components/events/FeedToolbar";
import type { SiteQr } from "@/components/qrcode/siteQrCode";
import { ErrorAlert, LoadingMessage } from "@/components/ui/Feedback";
import { ApplyFeedView, TagPills, type CardTag, type FeedCard, type FeedFilter } from "@/domain/feed";
import type { FeedStatus } from "@/hooks/useEvents";
import type { Result } from "@/lib/result";
import { FeaturedEvent } from "./featured-event";
import { UpdatedAgo } from "./UpdatedAgo";
import { FeaturedCard, WeekCards } from "./week-picks";
import { WeekRail } from "./week-rail";

/** Said when a search or filter leaves nothing to show. */
export const NO_MATCH_MESSAGE = "Nenhum evento encontrado para os critérios selecionados.";

/** Said when the organization has no upcoming events at all. */
export const EMPTY_FEED_MESSAGE = "Nenhum evento programado por enquanto.";

export type HomeContentProps = {
  /** QR code to the site, shown in the rail beside the hero on large screens. */
  qr: SiteQr;
  status: FeedStatus;
  /** Every card of the feed, in the API's ranking. */
  cards: FeedCard[];
  /** `YYYY-MM-DD` in Brazil. */
  today: string;
  /** When the feed was last fetched (ms since epoch). */
  updatedAt: number | null;
  /** Problems to show above the list (failed refresh, tags, likes). Empty entries are skipped. */
  errors: Array<string | null>;
  loginPromptFor: string | null;
  isLikeInFlight: (eventId: string) => boolean;
  onToggleLike: (eventId: string) => void;
  /** Called when the person shows intent to open an event, to load it beforehand. */
  onIntent?: (eventId: string) => void;
  onDelete: (eventId: string) => Promise<Result<void, string>>;
};

/** Heading of the list for the selected pill. */
function ListTitle(filter: FeedFilter, tags: CardTag[]): string {
  switch (filter.kind) {
    case "all":
      return "Todos os eventos";
    case "soonest":
      return "Os mais próximos";
    case "most-liked":
      return "Os mais curtidos";
    case "tag": {
      const { tagId } = filter;
      const tag = tags.find((candidate) => candidate.id === tagId);
      return tag === undefined ? "Eventos" : `Eventos de ${tag.name}`;
    }
  }
}

/** Hero and rail, then search, filter pills and the cards. */
export function HomeContent({
  qr, status, cards, today, updatedAt, errors, loginPromptFor, isLikeInFlight, onToggleLike, onIntent, onDelete,
}: HomeContentProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FeedFilter>({ kind: "all" });

  const tags = useMemo(() => TagPills(cards), [cards]);
  const shown = useMemo(() => ApplyFeedView(cards, { filter, query, today }), [cards, filter, query, today]);
  const week = useMemo(() => WeekCards(cards, today), [cards, today]);
  const featured = useMemo(() => FeaturedCard(cards, today), [cards, today]);
  const hero = status.kind === "ready" ? featured : null;
  const filtering = filter.kind !== "all" || query.trim() !== "";
  const backdrop = hero === null || hero.banner == null ? undefined : hero.banner.url;

  return (
    <main className="w-full px-4 pb-20 pt-6 sm:px-6 lg:px-8 lg:pt-10">
      {backdrop !== undefined && (
        // The page takes its colors from the hero's banner: a blurred copy fills the background.
        <div aria-hidden className="photo-backdrop">
          {/* eslint-disable-next-line @next/next/no-img-element -- decorative copy of the signed banner URL */}
          <img src={backdrop} alt="" />
        </div>
      )}

      {/* Same width as the top bar (`max-w-page`). */}
      <div className="mx-auto column w-full max-w-page gap-6 lg:gap-10">
        <h1 className="sr-only">Mural de Eventos</h1>

        {errors.map((error) => error !== null && error !== "" && <ErrorAlert key={error}>{error}</ErrorAlert>)}

        {/* Without a hero only the rail is left, and it is shown on large screens only. */}
        <div className={`${hero === null ? "hidden lg:flex" : "flex"} flex-wrap gap-5`}>
          {hero !== null && <FeaturedEvent card={hero} today={today} onIntent={onIntent} />}
          <WeekRail cards={status.kind === "ready" ? week : []} today={today} qr={qr} onIntent={onIntent} />
        </div>

        {status.kind === "loading" && <LoadingMessage>Carregando eventos...</LoadingMessage>}
        {status.kind === "error" && <ErrorAlert>{status.message}</ErrorAlert>}

        {status.kind === "ready" && (
          <>
            <FeedToolbar
              query={query}
              filter={filter}
              tags={tags}
              onQueryChange={setQuery}
              onFilterChange={setFilter}
              trailing={updatedAt === null ? undefined : <UpdatedAgo updatedAt={updatedAt} />}
            />

            <section aria-labelledby="feed-title" className="column gap-[18px]">
              <div className="row flex-wrap items-baseline gap-x-3.5 gap-y-1">
                <h2 id="feed-title" className="h2 text-2xl tracking-[-.025em] lg:text-[30px]">{ListTitle(filter, tags)}</h2>
                <span className="t3 font-mono text-xs uppercase lg:text-[13px]">
                  {shown.length} {shown.length === 1 ? "evento" : "eventos"}
                </span>
              </div>
              <EventList
                cards={shown}
                today={today}
                emptyMessage={filtering || cards.length > 0 ? NO_MATCH_MESSAGE : EMPTY_FEED_MESSAGE}
                isLikeInFlight={isLikeInFlight}
                loginPromptFor={loginPromptFor}
                loginRedirect="/"
                onToggleLike={onToggleLike}
                onIntent={onIntent}
                onDelete={onDelete}
              />
            </section>
          </>
        )}
      </div>
    </main>
  );
}
