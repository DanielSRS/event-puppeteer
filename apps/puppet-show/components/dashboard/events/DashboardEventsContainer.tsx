/**
 * "Meus Eventos": the logged-in person's events in the managed organization
 * (`GET .../events/mine`, so hidden and past ones too), creating new ones with
 * the event editor and deleting with confirmation. "Novo evento" sits in the
 * page header on wide screens and floats at the bottom right on phones.
 *
 * A Superadmin inside an organization sees the events they created there.
 *
 * @module
 */

"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { MdAdd } from "react-icons/md";
import { EventFormContainer } from "@/components/forms/containers/EventFormContainer";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Drawer } from "@/components/ui/Drawer";
import { StatusMessage } from "@/components/ui/Feedback";
import { PageHeader } from "@/components/dashboard/page-header";
import { api, ApiErrorMessage } from "@/lib/api/client";
import { Freshness } from "@/lib/query/options";
import { LoadedQuery } from "@/lib/query/loaded";
import { feedQuery, ownEventsKey } from "@/lib/query/queries";
import { useLoaded } from "@/lib/query/useLoaded";
import { Err, Ok, type Result } from "@/lib/result";
import { TodayInBrazil } from "@/utils/date";
import { SelectOrgNotice, useDashboard } from "../DashboardContext";
import { ToOwnEvent, type OwnEvent } from "./OwnEvents";
import { UserEventList, type UserEventListState } from "./UserEventList";

/** Loads the person's events in `orgId`. */
async function LoadOwnEvents(orgId: string): Promise<Result<OwnEvent[], string>> {
  const mine = await api.events.mine(orgId);
  if (!mine.ok) return Err(`Não foi possível carregar seus eventos. ${ApiErrorMessage(mine.error)}`);
  const today = TodayInBrazil();
  return Ok(mine.value.map((event) => ToOwnEvent(event, today)));
}

/** The person's events in `orgId`, as the page lists them. */
export const ownEventListQuery = (orgId: string) =>
  LoadedQuery(ownEventsKey(orgId), () => LoadOwnEvents(orgId), Freshness.short);

/** Title and description of the page; `onCreate` adds the "Novo evento" button (hidden on phones, which get a floating one). */
function EventsHeader({ onCreate }: { onCreate?: () => void }) {
  return (
    <PageHeader
      title="Meus Eventos"
      description="Os eventos que você publicou e o que cada um precisa de você."
      actions={onCreate === undefined ? undefined : (
        <button type="button" onClick={onCreate} className="button main min-h-12 px-5 text-[15px] max-md:hidden">
          <MdAdd aria-hidden className="h-[18px] w-[18px]" /> Novo evento
        </button>
      )}
    />
  );
}

/** The "Meus Eventos" page. */
export function DashboardEventsContainer() {
  const { orgId } = useDashboard();

  const client = useQueryClient();
  const events = useLoaded(ownEventListQuery(orgId === null ? "" : orgId), orgId !== null);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState("");
  const [deleting, setDeleting] = useState<OwnEvent | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  if (orgId === null) return <><EventsHeader /><SelectOrgNotice /></>;

  const state: UserEventListState = events.result === null
    ? { status: "loading" }
    : events.result.ok ? { status: "ready", events: events.result.value } : { status: "error", message: events.result.error };

  /** The feed and the event pages show what this list changes. */
  function eventsChanged(id: string | null) {
    void client.invalidateQueries({ queryKey: feedQuery(orgId === null ? "" : orgId).queryKey });
    if (id !== null) client.removeQueries({ queryKey: ["event"], predicate: (query) => query.queryKey[2] === id });
  }

  async function confirmDelete() {
    if (deleting === null || orgId === null) return;
    setDeleteBusy(true);
    setDeleteError("");
    const removed = await api.events.delete(orgId, deleting.id);
    setDeleteBusy(false);
    if (!removed.ok) {
      setDeleteError(`Não foi possível excluir o evento. ${ApiErrorMessage(removed.error)}`);
      return;
    }
    const { id, title } = deleting;
    setDeleting(null);
    setNotice(`Evento "${title}" excluído.`);
    events.update((list) => list.filter((event) => event.id !== id));
    eventsChanged(id);
  }

  const startCreating = () => { setNotice(""); setCreating(true); };

  return (
    <>
      <EventsHeader onCreate={startCreating} />

      <StatusMessage>{notice}</StatusMessage>

      <UserEventList
        state={state}
        onDelete={(event) => { setNotice(""); setDeleteError(""); setDeleting(event); }}
        onRetry={events.reload}
      />

      <button
        type="button"
        onClick={startCreating}
        className="button main fixed bottom-5 right-4 z-20 min-h-14 rounded-[18px] px-5 text-[15px] shadow-[0_16px_40px_-12px_var(--accent)] md:hidden"
      >
        <MdAdd aria-hidden className="h-5 w-5" /> Novo evento
      </button>

      <Drawer isOpen={creating} onClose={() => setCreating(false)} title="Novo evento" width="lg">
        <EventFormContainer
          orgId={orgId}
          onCancel={() => setCreating(false)}
          onCreated={(event) => {
            setCreating(false);
            setNotice(`Evento "${event.title}" publicado.`);
            events.reload();
            eventsChanged(null);
          }}
        />
      </Drawer>

      <ConfirmDialog
        isOpen={deleting !== null}
        title="Excluir este evento?"
        confirmLabel="Sim, excluir"
        danger
        busy={deleteBusy}
        error={deleteError}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      >
        {deleting === null ? null : <>&quot;{deleting.title}&quot; sai do mural e da sua lista. Essa ação não pode ser desfeita.</>}
      </ConfirmDialog>
    </>
  );
}
