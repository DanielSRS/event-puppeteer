/**
 * Connects the {@link EventForm} to the API: loads the tag and link-label
 * catalogs, creates free-form tags, reads the device position, publishes the
 * event in the given organization and then uploads its banner.
 *
 * The banner can only be uploaded once the event exists. When that upload
 * fails the event is already published: the person is told so (and that the
 * banner can be sent again from the event's page) before moving on.
 *
 * Used by the dashboard (inside the organization being managed) and by
 * `/eventos/novo` (the person's own organization).
 *
 * @module
 */

"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { EventForm } from "../EventForm";
import type { Coordinates } from "../EventFormBasics";
import { ErrorAlert, LoadingMessage } from "@/components/ui/Feedback";
import { api, ApiErrorMessage } from "@/lib/api/client";
import type { CreateEventInput, Event, Tag } from "@/lib/api/schemas";
import { feedQuery, linkLabelsQuery, ownEventsKey, tagsQuery } from "@/lib/query/queries";
import { useApiQuery } from "@/lib/query/useApiQuery";
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

/** The event editor wired to the API. */
export function EventFormContainer({ orgId, onCreated, onCancel }: EventFormContainerProps) {
  const [today] = useState(TodayInBrazil);
  const client = useQueryClient();
  const tags = useApiQuery(tagsQuery());
  const linkLabels = useApiQuery(linkLabelsQuery());
  const [busy, setBusy] = useState(false);
  const [generalError, setGeneralError] = useState("");
  /** The event published without its banner, and why the banner upload failed. */
  const [bannerFailure, setBannerFailure] = useState<{ event: Event; message: string } | null>(null);

  function reloadCatalog() {
    tags.refetch();
    linkLabels.refetch();
  }

  /** Adds `tag` to the catalog the form offers (and every other screen), unless it's already there. */
  function remember(tag: Tag) {
    client.setQueryData(tagsQuery().queryKey, (current) => {
      if (current === undefined || !current.ok || current.value.some((known) => known.id === tag.id)) return current;
      return Ok([...current.value, tag]);
    });
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
    client.setQueryData(tagsQuery().queryKey, Ok(all.value));

    const wanted = name.trim().toLocaleLowerCase("pt-BR");
    const existing = all.value.find((tag) => tag.name.trim().toLocaleLowerCase("pt-BR") === wanted);
    if (existing === undefined)
      return Err("O servidor diz que essa tag já existe, mas ela não aparece na lista de tags. Tente outro nome.");
    return Ok(existing);
  }

  async function submit(input: CreateEventInput, banner: Blob | null) {
    setBusy(true);
    setGeneralError("");
    const created = await api.events.create(orgId, input);
    if (!created.ok) {
      setBusy(false);
      setGeneralError(`Não foi possível publicar o evento. ${ApiErrorMessage(created.error)}`);
      return;
    }
    if (banner !== null) {
      const uploaded = await api.images.uploadBanner(orgId, created.value.id, banner);
      if (!uploaded.ok) {
        setBusy(false);
        setBannerFailure({ event: created.value, message: ApiErrorMessage(uploaded.error) });
        return;
      }
    }
    setBusy(false);
    void client.invalidateQueries({ queryKey: feedQuery(orgId).queryKey });
    void client.invalidateQueries({ queryKey: ownEventsKey(orgId) });
    onCreated(created.value);
  }

  if (bannerFailure !== null) {
    return (
      <div className="column gap-3">
        <ErrorAlert>
          O evento foi publicado, mas o banner não pôde ser enviado. {bannerFailure.message} Você pode enviar o banner de novo na página do evento.
        </ErrorAlert>
        <button type="button" onClick={() => onCreated(bannerFailure.event)} className="button self-start min-h-10">Continuar</button>
      </div>
    );
  }

  if (tags.value === null || linkLabels.value === null) {
    const message = tags.error !== null
      ? `Não foi possível carregar as tags. ${ApiErrorMessage(tags.error)}`
      : linkLabels.error !== null
        ? `Não foi possível carregar os tipos de link. ${ApiErrorMessage(linkLabels.error)}`
        : null;
    if (message === null) return <LoadingMessage>Carregando tags e tipos de link...</LoadingMessage>;
    return (
      <div className="column gap-3">
        <ErrorAlert>{message}</ErrorAlert>
        <button type="button" onClick={reloadCatalog} className="button clean self-start min-h-10">Tentar de novo</button>
      </div>
    );
  }

  return (
    <EventForm
      tags={tags.value}
      linkLabels={linkLabels.value}
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
