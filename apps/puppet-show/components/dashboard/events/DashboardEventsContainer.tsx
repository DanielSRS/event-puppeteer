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

import { useEffect, useState } from "react";
import { MdAdd } from "react-icons/md";
import { EventFormContainer } from "@/components/forms/containers/EventFormContainer";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Drawer } from "@/components/ui/Drawer";
import { StatusMessage } from "@/components/ui/Feedback";
import { api, ApiErrorMessage } from "@/lib/api/client";
import { TodayInBrazil } from "@/utils/date";
import { SelectOrgNotice, useDashboard } from "../DashboardContext";
import { ToOwnEvent, type OwnEvent } from "./OwnEvents";
import { UserEventList, type UserEventListState } from "./UserEventList";

/** The list state together with the organization it was loaded for. */
type Loaded = { orgId: string; state: UserEventListState };

/** Loads the person's events in `orgId`. */
async function LoadOwnEvents(orgId: string): Promise<UserEventListState> {
  const mine = await api.events.mine(orgId);
  if (!mine.ok) return { status: "error", message: `Não foi possível carregar seus eventos. ${ApiErrorMessage(mine.error)}` };
  const today = TodayInBrazil();
  return { status: "ready", events: mine.value.map((event) => ToOwnEvent(event, today)) };
}

/** The "Meus Eventos" page. */
export function DashboardEventsContainer() {
  const { orgId } = useDashboard();

  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState("");
  const [deleting, setDeleting] = useState<OwnEvent | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    if (orgId === null) return;
    let active = true;
    LoadOwnEvents(orgId).then((state) => { if (active) setLoaded({ orgId, state }); });
    return () => { active = false; };
  }, [orgId, reloadKey]);

  if (orgId === null) return <SelectOrgNotice />;

  const state: UserEventListState = loaded !== null && loaded.orgId === orgId ? loaded.state : { status: "loading" };

  function reload() {
    setLoaded(null);
    setReloadKey((key) => key + 1);
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
    setLoaded((current) => current !== null && current.state.status === "ready"
      ? { ...current, state: { status: "ready", events: current.state.events.filter((event) => event.id !== id) } }
      : current);
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
        onRetry={reload}
      />

      <Drawer isOpen={creating} onClose={() => setCreating(false)} title="Novo evento" width="lg">
        <EventFormContainer
          orgId={orgId}
          onCancel={() => setCreating(false)}
          onCreated={(event) => {
            setCreating(false);
            setNotice(`Evento "${event.title}" publicado.`);
            reload();
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
