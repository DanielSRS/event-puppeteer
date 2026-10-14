/**
 * "Meus Eventos": the logged-in person's events in the managed organization
 * (`GET .../events/mine`, so hidden and past ones too), creating new ones with
 * the event editor and deleting with confirmation.
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

  if (orgId === null) return <SelectOrgNotice />;

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

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="title">Meus Eventos</h1>
        <button type="button" onClick={() => { setNotice(""); setCreating(true); }} className="button main min-h-10">
          <MdAdd aria-hidden className="icon" /> Novo evento
        </button>
      </div>

      <StatusMessage>{notice}</StatusMessage>

      <UserEventList
        state={state}
        onDelete={(event) => { setNotice(""); setDeleteError(""); setDeleting(event); }}
        onRetry={events.reload}
      />

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
