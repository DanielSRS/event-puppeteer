/**
 * Connects the {@link EventForm} to the API: loads the tag and link-label
 * catalogs, creates free-form tags, reads the device position and publishes
 * the event in the given organization.
 *
 * Used by the dashboard (inside the organization being managed) and by
 * `/eventos/novo` (the person's own organization).
 *
 * @module
 */

"use client";

import { useEffect, useState } from "react";
import { EventForm } from "../EventForm";
import type { Coordinates } from "../EventFormBasics";
import { ErrorAlert, LoadingMessage } from "@/components/ui/Feedback";
import { api, ApiErrorMessage } from "@/lib/api/client";
import type { CreateEventInput, Event, LinkLabel, Tag } from "@/lib/api/schemas";
import { Err, Ok, type Result } from "@/lib/result";
import { TodayInBrazil } from "@/utils/date";

/** Props of {@link EventFormContainer}. */
export type EventFormContainerProps = {
  /** Organization the event is published in. */
  orgId: string;
  /** Called with the event the API created. */
  onCreated: (event: Event) => void;
  /** Shows a "Cancelar" button when given. */
  onCancel?: () => void;
};

/** Where the catalogs stand. */
type Catalog =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; tags: Tag[]; linkLabels: LinkLabel[] };

/** Message for each way the browser can fail to give a position. */
function GeolocationMessage(error: GeolocationPositionError): string {
  if (error.code === error.PERMISSION_DENIED)
    return "Permissão de localização negada. Autorize o acesso à localização nas configurações do navegador (ele só é oferecido em endereços https) ou digite as coordenadas.";
  if (error.code === error.POSITION_UNAVAILABLE)
    return "O dispositivo não conseguiu determinar sua localização. Tente de novo ou digite as coordenadas.";
  if (error.code === error.TIMEOUT)
    return "A localização demorou demais para chegar. Tente de novo ou digite as coordenadas.";
  return `Não foi possível obter a localização: ${error.message}`;
}

/** Asks the browser for the device position. */
function ReadPosition(): Promise<Result<Coordinates, string>> {
  if (!("geolocation" in navigator))
    return Promise.resolve(Err("Este navegador não informa a localização. Digite as coordenadas."));

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(Ok({ latitude: position.coords.latitude, longitude: position.coords.longitude })),
      (error) => resolve(Err(GeolocationMessage(error))),
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  });
}

/** Loads the tags and link labels the editor offers. */
async function FetchCatalog(): Promise<Catalog> {
  const [tags, linkLabels] = await Promise.all([api.tags.list(), api.linkLabels.list()]);
  if (!tags.ok) return { status: "error", message: `Não foi possível carregar as tags. ${ApiErrorMessage(tags.error)}` };
  if (!linkLabels.ok)
    return { status: "error", message: `Não foi possível carregar os tipos de link. ${ApiErrorMessage(linkLabels.error)}` };
  return { status: "ready", tags: tags.value, linkLabels: linkLabels.value };
}

/** The event editor wired to the API. */
export function EventFormContainer({ orgId, onCreated, onCancel }: EventFormContainerProps) {
  const [today] = useState(TodayInBrazil);
  const [catalog, setCatalog] = useState<Catalog>({ status: "loading" });
  const [busy, setBusy] = useState(false);
  const [generalError, setGeneralError] = useState("");

  useEffect(() => {
    let active = true;
    FetchCatalog().then((next) => { if (active) setCatalog(next); });
    return () => { active = false; };
  }, []);

  async function reloadCatalog() {
    setCatalog({ status: "loading" });
    setCatalog(await FetchCatalog());
  }

  /** Adds `tag` to the catalog the form offers, unless it's already there. */
  function remember(tag: Tag) {
    setCatalog((current) => current.status === "ready" && !current.tags.some((known) => known.id === tag.id)
      ? { ...current, tags: [...current.tags, tag] }
      : current);
  }

  async function createTag(name: string): Promise<Result<Tag, string>> {
    const created = await api.tags.create(name, false);
    if (created.ok) {
      remember(created.value);
      return Ok(created.value);
    }
    if (created.error.kind !== "http" || created.error.status !== 409)
      return Err(`Não foi possível criar a tag. ${ApiErrorMessage(created.error)}`);

    const all = await api.tags.list();
    if (!all.ok) return Err(`A tag já existe, mas não foi possível carregá-la. ${ApiErrorMessage(all.error)}`);
    setCatalog((current) => current.status === "ready" ? { ...current, tags: all.value } : current);

    const wanted = name.trim().toLocaleLowerCase("pt-BR");
    const existing = all.value.find((tag) => tag.name.trim().toLocaleLowerCase("pt-BR") === wanted);
    if (existing === undefined)
      return Err("O servidor diz que essa tag já existe, mas ela não aparece na lista de tags. Tente outro nome.");
    return Ok(existing);
  }

  async function submit(input: CreateEventInput) {
    setBusy(true);
    setGeneralError("");
    const created = await api.events.create(orgId, input);
    setBusy(false);
    if (!created.ok) {
      setGeneralError(`Não foi possível publicar o evento. ${ApiErrorMessage(created.error)}`);
      return;
    }
    onCreated(created.value);
  }

  if (catalog.status === "loading") return <LoadingMessage>Carregando tags e tipos de link...</LoadingMessage>;

  if (catalog.status === "error") {
    return (
      <div className="column gap-3">
        <ErrorAlert>{catalog.message}</ErrorAlert>
        <button type="button" onClick={reloadCatalog} className="button clean self-start min-h-10">Tentar de novo</button>
      </div>
    );
  }

  return (
    <EventForm
      tags={catalog.tags}
      linkLabels={catalog.linkLabels}
      today={today}
      busy={busy}
      generalError={generalError}
      onSubmit={submit}
      onCancel={onCancel}
      onCreateTag={createTag}
      onLocate={ReadPosition}
    />
  );
}
