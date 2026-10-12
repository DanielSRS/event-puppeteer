/**
 * A queue of Images awaiting Image Review wired to the API: loads it, approves
 * at once, and rejects after a confirmation that says the uploader will be
 * shadow-banned. An Image someone else decided meanwhile (409) leaves the
 * queue with a note. Shared by the organization's queue and the Superadmin's
 * escalated one.
 *
 * @module
 */

"use client";

import { useEffect, useState } from "react";
import { api, ApiErrorMessage, type ApiResult } from "@/lib/api/client";
import type { ImageReviewItem } from "@/lib/api/schemas";
import { Err, Ok, type Result } from "@/lib/result";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ErrorAlert, LoadingMessage, StatusMessage } from "@/components/ui/Feedback";
import { ImageReviewList, ImageSubject } from "./ImageReviewList";

export type ImageReviewQueueProps = {
  /** Fetches the queue. */
  load: () => Promise<ApiResult<ImageReviewItem[]>>;
  /** Organization names by id, for queues that mix organizations. */
  organizationNames?: ReadonlyMap<string, string>;
};

/** Whether an API error says the Image was already decided by someone else. */
function AlreadyDecided(result: ApiResult<unknown>): boolean {
  return !result.ok && result.error.kind === "http" && result.error.status === 409;
}

/** The queue and its decisions. */
export function ImageReviewQueue({ load, organizationNames }: ImageReviewQueueProps) {
  const [items, setItems] = useState<Result<ImageReviewItem[], string> | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<ImageReviewItem | null>(null);
  const [dialogError, setDialogError] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    load().then((result) => {
      if (!active) return;
      setItems(result.ok ? Ok(result.value) : Err(`Não foi possível carregar as imagens em revisão. ${ApiErrorMessage(result.error)}`));
    });
    return () => { active = false; };
  }, [load]);

  const drop = (item: ImageReviewItem) =>
    setItems((current) => current !== null && current.ok ? Ok(current.value.filter((i) => i.id !== item.id)) : current);

  const approve = async (item: ImageReviewItem) => {
    setStatus("");
    setError("");
    setBusyId(item.id);
    const result = await api.images.approve(item.id);
    setBusyId(null);
    if (AlreadyDecided(result)) {
      drop(item);
      return setStatus(`${ImageSubject(item)} já tinha sido analisada por outra pessoa.`);
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
    if (AlreadyDecided(result)) {
      drop(item);
      setRejecting(null);
      return setStatus(`${ImageSubject(item)} já tinha sido analisada por outra pessoa.`);
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
