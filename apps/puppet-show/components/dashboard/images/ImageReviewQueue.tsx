/**
 * A queue of Images awaiting Image Review wired to the API: loads it, approves
 * at once, and rejects after a confirmation that says the uploader will be
 * shadow-banned. An Image someone else decided meanwhile, or that its uploader
 * replaced or removed (409), leaves the queue with a note. Shared by the organization's queue and the Superadmin's
 * escalated one.
 *
 * @module
 */

"use client";

import { useState } from "react";
import { api, ApiErrorMessage, type ApiResult } from "@/lib/api/client";
import type { ImageReviewItem } from "@/lib/api/schemas";
import { Err, Ok } from "@/lib/result";
import { Freshness } from "@/lib/query/options";
import { LoadedQuery } from "@/lib/query/loaded";
import { useLoaded } from "@/lib/query/useLoaded";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ErrorAlert, LoadingMessage, StatusMessage } from "@/components/ui/Feedback";
import { ImageReviewList, ImageSubject } from "./ImageReviewList";

export type ImageReviewQueueProps = {
  /** Identifies this queue in the cache. */
  cacheKey: readonly unknown[];
  /** Fetches the queue. */
  load: () => Promise<ApiResult<ImageReviewItem[]>>;
  /** Organization names by id, for queues that mix organizations. */
  organizationNames?: ReadonlyMap<string, string>;
};

/**
 * Why the Image can no longer be decided (someone else decided it, or its uploader replaced
 * or removed it), or `null` when the API said something else.
 */
function Undecidable(result: ApiResult<unknown>, item: ImageReviewItem): string | null {
  if (result.ok || result.error.kind !== "http" || result.error.status !== 409) return null;
  return result.error.code === "IMAGE_NO_LONGER_CURRENT"
    ? `${ImageSubject(item)} foi substituída ou removida por quem enviou e não será exibida.`
    : `${ImageSubject(item)} já tinha sido analisada por outra pessoa.`;
}

/** The Images of a queue as the page lists them, cached under `cacheKey`. */
export const imageReviewQuery = (cacheKey: readonly unknown[], load: ImageReviewQueueProps["load"]) =>
  LoadedQuery(cacheKey, async () => {
    const result = await load();
    return result.ok ? Ok(result.value) : Err(`Não foi possível carregar as imagens em revisão. ${ApiErrorMessage(result.error)}`);
  }, Freshness.live);

/** The queue and its decisions. */
export function ImageReviewQueue({ cacheKey, load, organizationNames }: ImageReviewQueueProps) {
  const loaded = useLoaded(imageReviewQuery(cacheKey, load));
  const items = loaded.result;
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<ImageReviewItem | null>(null);
  const [dialogError, setDialogError] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const drop = (item: ImageReviewItem) => loaded.update((list) => list.filter((i) => i.id !== item.id));

  const approve = async (item: ImageReviewItem) => {
    setStatus("");
    setError("");
    setBusyId(item.id);
    const result = await api.images.approve(item.id);
    setBusyId(null);
    const gone = Undecidable(result, item);
    if (gone !== null) {
      drop(item);
      return setStatus(gone);
    }
    if (!result.ok) return setError(`Não foi possível aprovar a imagem. ${ApiErrorMessage(result.error)}`);
    drop(item);
    setStatus(`${ImageSubject(item)} aprovada: agora aparece para todos.`);
  };

  const reject = async () => {
    if (rejecting === null) return;
    const item = rejecting;
    setDialogError("");
    setBusyId(item.id);
    const result = await api.images.reject(item.id);
    setBusyId(null);
    const gone = Undecidable(result, item);
    if (gone !== null) {
      drop(item);
      setRejecting(null);
      return setStatus(gone);
    }
    if (!result.ok) return setDialogError(`Não foi possível rejeitar a imagem. ${ApiErrorMessage(result.error)}`);
    drop(item);
    setRejecting(null);
    setStatus(`${ImageSubject(item)} rejeitada. ${item.uploaderName} está agora em shadow ban.`);
  };

  if (items === null) return <LoadingMessage>Carregando imagens em revisão...</LoadingMessage>;
  if (!items.ok) return <ErrorAlert>{items.error}</ErrorAlert>;

  return (
    <div className="column gap-4">
      <StatusMessage>{status}</StatusMessage>
      <ErrorAlert>{error}</ErrorAlert>
      <ImageReviewList
        items={items.value}
        busyId={busyId}
        onApprove={(item) => void approve(item)}
        onReject={(item) => { setStatus(""); setError(""); setDialogError(""); setRejecting(item); }}
        {...(organizationNames !== undefined ? { organizationNames } : {})}
      />
      <ConfirmDialog
        isOpen={rejecting !== null}
        title="Rejeitar esta imagem?"
        confirmLabel="Sim, rejeitar"
        danger
        busy={busyId !== null}
        error={dialogError}
        onConfirm={() => void reject()}
        onCancel={() => setRejecting(null)}
      >
        {rejecting !== null && (
          <p>
            {ImageSubject(rejecting)} nunca será exibida e {rejecting.uploaderName} entrará em shadow ban: o que essa pessoa publicar
            deixa de aparecer para os outros, sem que ela seja avisada. A decisão fica registrada na auditoria.
          </p>
        )}
      </ConfirmDialog>
    </div>
  );
}
