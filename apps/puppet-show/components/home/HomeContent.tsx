/**
 * The home page: the public feed people browse, like and filter.
 *
 * @module
 */

"use client";

import { useMemo, useState } from "react";
import { EventList } from "@/components/events/EventList";
import { FeedToolbar } from "@/components/events/FeedToolbar";
import { QrCodePanel } from "@/components/qrcode/QrCodePanel";
import type { SiteQr } from "@/components/qrcode/siteQrCode";
import { ErrorAlert, LoadingMessage } from "@/components/ui/Feedback";
import { ApplyFeedView, TagPills, type FeedCard, type FeedFilter } from "@/domain/feed";
import type { FeedStatus } from "@/hooks/useEvents";
import type { Result } from "@/lib/result";
import { UpdatedAgo } from "./UpdatedAgo";

/** Said when a search or filter leaves nothing to show. */
export const NO_MATCH_MESSAGE = "Nenhum evento encontrado para os critérios selecionados.";

/** Said when the organization has no upcoming events at all. */
export const EMPTY_FEED_MESSAGE = "Nenhum evento programado por enquanto.";

export type HomeContentProps = {
  /** QR code to the site, shown beside the feed on large screens. */
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
  onDelete: (eventId: string) => Promise<Result<void, string>>;
};

/** Search, filter pills and the cards; the QR code sits beside them on large screens. */
export function HomeContent({
  qr, status, cards, today, updatedAt, errors, loginPromptFor, isLikeInFlight, onToggleLike, onDelete,
}: HomeContentProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FeedFilter>({ kind: "all" });

  const tags = useMemo(() => TagPills(cards), [cards]);
  const shown = useMemo(() => ApplyFeedView(cards, { filter, query, today }), [cards, filter, query, today]);
  const filtering = filter.kind !== "all" || query.trim() !== "";

  return (
    <main className="w-full max-w-6xl mx-auto p-4 lg:p-6 flex flex-col gap-6 lg:flex-row lg:items-start">
      <div className="column gap-4 flex-1 min-w-0">
        <header className="column gap-1">
          <h1 className="title">Mural de Eventos</h1>
          {status.kind === "ready" && updatedAt !== null && <UpdatedAgo updatedAt={updatedAt} />}
        </header>

        {errors.map((error) => error !== null && error !== "" && <ErrorAlert key={error}>{error}</ErrorAlert>)}

        {status.kind === "loading" && <LoadingMessage>Carregando eventos...</LoadingMessage>}
        {status.kind === "error" && <ErrorAlert>{status.message}</ErrorAlert>}

        {status.kind === "ready" && (
          <>
            <FeedToolbar query={query} filter={filter} tags={tags} onQueryChange={setQuery} onFilterChange={setFilter} />
            <EventList
              cards={shown}
              today={today}
              emptyMessage={filtering || cards.length > 0 ? NO_MATCH_MESSAGE : EMPTY_FEED_MESSAGE}
              isLikeInFlight={isLikeInFlight}
              loginPromptFor={loginPromptFor}
              loginRedirect="/"
              onToggleLike={onToggleLike}
              onDelete={onDelete}
            />
          </>
        )}
      </div>

      <aside aria-label="Acesse pelo celular" className="hidden lg:block w-72 shrink-0 lg:sticky lg:top-20">
        <QrCodePanel qr={qr} />
      </aside>
    </main>
  );
}
