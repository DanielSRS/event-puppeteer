/**
 * The feed's cards, with the "delete my event" confirmation.
 *
 * @module
 */

"use client";

import { useState } from "react";
import { MdEvent } from "react-icons/md";
import type { FeedCard } from "@/domain/feed";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { StatusMessage } from "@/components/ui/Feedback";
import type { Result } from "@/lib/result";
import { EventCard } from "./EventCard";

export type EventListProps = {
  /** Cards to show, already searched/filtered/sorted. */
  cards: FeedCard[];
  /** `YYYY-MM-DD`; decides which day each badge features. */
  today: string;
  /** Said when `cards` is empty. */
  emptyMessage: string;
  /** Whether the like request for an event is running. */
  isLikeInFlight: (eventId: string) => boolean;
  /** Event an anonymous visitor tried to like; its card asks them to log in. */
  loginPromptFor: string | null;
  /** Path to come back to after logging in. */
  loginRedirect: string;
  onToggleLike: (eventId: string) => void;
  /** Called when the person shows intent to open an event, to load it beforehand. */
  onIntent?: (eventId: string) => void;
  /** Deletes one of the viewer's own events; the error is text for the person. */
  onDelete: (eventId: string) => Promise<Result<void, string>>;
};

/**
 * The cards in a responsive grid (one column of compact rows on phones, as
 * many 320 px columns as fit above that), an empty state, and the
 * confirmation before deleting an own event.
 */
export function EventList({
  cards, today, emptyMessage, isLikeInFlight, loginPromptFor, loginRedirect, onToggleLike, onIntent, onDelete,
}: EventListProps) {
  const [deleting, setDeleting] = useState<{ id: string; title: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [notice, setNotice] = useState("");

  const confirmDelete = async () => {
    if (deleting === null) return;
    setBusy(true);
    setDeleteError("");
    const result = await onDelete(deleting.id);
    setBusy(false);
    if (!result.ok) {
      setDeleteError(`Não foi possível excluir o evento. ${result.error}`);
      return;
    }
    setNotice(`“${deleting.title}” foi excluído.`);
    setDeleting(null);
  };

  return (
    <div className="column gap-4">
      <StatusMessage>{notice}</StatusMessage>

      {cards.length === 0 ? (
        <div className="glass column items-center gap-3 rounded-[26px] px-6 py-12 text-center">
          <MdEvent aria-hidden className="t3 h-8 w-8" />
          <p className="t2 max-w-md">{emptyMessage}</p>
        </div>
      ) : (
        <ul aria-label="Eventos" className="grid grid-cols-1 gap-3 sm:gap-5 sm:[grid-template-columns:repeat(auto-fill,minmax(min(320px,100%),1fr))]">
          {cards.map((card) => (
            <li key={card.id} className="min-w-0">
              <EventCard
                card={card}
                today={today}
                likeBusy={isLikeInFlight(card.id)}
                loginPrompt={loginPromptFor === card.id}
                loginRedirect={loginRedirect}
                onToggleLike={onToggleLike}
                onIntent={onIntent}
                onDelete={(id) => {
                  setNotice("");
                  setDeleteError("");
                  setDeleting({ id, title: card.title });
                }}
              />
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        isOpen={deleting !== null}
        title="Excluir este evento?"
        confirmLabel="Sim, excluir"
        danger
        busy={busy}
        error={deleteError}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleting(null)}
      >
        {deleting === null ? null : <>“{deleting.title}” sai do mural e dos totens. Esta ação não pode ser desfeita.</>}
      </ConfirmDialog>
    </div>
  );
}
