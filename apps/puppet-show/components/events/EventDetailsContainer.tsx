/**
 * Loads one event and wires the details page actions to the API.
 *
 * @module
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Drawer } from "@/components/ui/Drawer";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ErrorAlert, LoadingMessage } from "@/components/ui/Feedback";
import { useAuth } from "@/hooks/useAuth";
import { FeedOrgId } from "@/hooks/useEvents";
import { api, ApiErrorMessage } from "@/lib/api/client";
import { MISSING_ORG_MESSAGE } from "@/lib/api/session";
import { UserOrgId, type User } from "@/lib/api/schemas";
import { ToEventDetail, type EventDetail } from "@/lib/api/mappers";
import { ConfirmVote, IsVoteInFlight, ShownVoteFor, StartVote, type PendingVote } from "@/domain/likes";
import { EventDetails, type LoginPrompt } from "./EventDetails";
import { ReportForm, type ReportFormData } from "./ReportForm";

/**
 * Said when the API answers 404: missing, deleted or other-organization events,
 * and hidden ones (or by shadow-banned authors) for anyone but their creator,
 * the organization's Moderators+ and the Superadmin.
 */
export const UNAVAILABLE_MESSAGE = "Evento não encontrado ou indisponível.";

/** Said when the API refuses a second report from the same person. */
export const ALREADY_REPORTED_MESSAGE = "Você já denunciou este evento.";

export type EventDetailsContainerProps = {
  eventId: string;
};

/** Whether `user` may hide/unhide events of `orgId`. */
function CanModerate(user: User | null, orgId: string): boolean {
  if (user === null) return false;
  if (user.role === "Superadmin") return true;
  return UserOrgId(user) === orgId && (user.role === "Admin" || user.role === "Moderator");
}

/** The likes the details page knows: the feed count plus the viewer's vote. */
type Likes = { serverCount: number; viewerVoted: boolean; pending: PendingVote | undefined };

type Load =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; event: EventDetail; likes: Likes | null; threshold: number | null };

/** Which confirmation is open. */
type Confirm = "hide" | "delete" | null;

/**
 * Fetches the event with the tag and link-label catalogs (for names), its
 * vote count (from the feed, the only place the API counts votes), the
 * viewer's vote and the organization's report threshold.
 */
export function EventDetailsContainer({ eventId }: EventDetailsContainerProps) {
  const router = useRouter();
  const { state: auth, user } = useAuth();
  const orgId = FeedOrgId(user);
  const viewerId = user === null ? null : user.id;
  const ready = auth.status === "anonymous" || auth.status === "authenticated";

  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loginPrompt, setLoginPrompt] = useState<LoginPrompt | null>(null);
  const [reported, setReported] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reportSending, setReportSending] = useState(false);
  const [reportError, setReportError] = useState("");
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmError, setConfirmError] = useState("");

  /** Reads the feed's vote count for this event; `null` when the event isn't in the feed. */
  const fetchCount = useCallback(async (org: string): Promise<{ ok: true; count: number | null } | { ok: false; message: string }> => {
    const feed = await api.organizations.feed(org);
    if (!feed.ok) return { ok: false, message: `Não foi possível carregar as curtidas. ${ApiErrorMessage(feed.error)}` };
    const entry = feed.value.find((item) => item.id === eventId);
    return { ok: true, count: entry === undefined ? null : entry.voteCount };
  }, [eventId]);

  useEffect(() => {
    if (!ready || orgId === null) return;
    let active = true;

    (async () => {
      const [event, tags, labels, org, count] = await Promise.all([
        api.events.get(orgId, eventId),
        api.tags.list(),
        api.linkLabels.list(),
        api.organizations.get(orgId),
        fetchCount(orgId),
      ]);
      if (!active) return;

      if (!event.ok) {
        const notFound = event.error.kind === "http" && event.error.status === 404;
        setLoad({ kind: "error", message: notFound ? UNAVAILABLE_MESSAGE : ApiErrorMessage(event.error) });
        return;
      }
      if (!tags.ok) return setLoad({ kind: "error", message: `Não foi possível carregar as categorias. ${ApiErrorMessage(tags.error)}` });
      if (!labels.ok) return setLoad({ kind: "error", message: `Não foi possível carregar os links. ${ApiErrorMessage(labels.error)}` });
      if (!count.ok) return setLoad({ kind: "error", message: count.message });

      const detail = ToEventDetail(event.value, tags.value, labels.value);

      let viewerVoted = false;
      if (viewerId !== null && count.count !== null) {
        const status = await api.events.voteStatus(orgId, eventId);
        if (!active) return;
        if (!status.ok) return setLoad({ kind: "error", message: `Não foi possível saber se você curtiu este evento. ${ApiErrorMessage(status.error)}` });
        viewerVoted = status.value.voted;
      }

      setLoad({
        kind: "ready",
        event: detail,
        likes: count.count === null ? null : { serverCount: count.count, viewerVoted, pending: undefined },
        threshold: org.ok ? org.value.shadowBanThreshold : null,
      });
      if (!org.ok) setError(`Não foi possível carregar as regras de denúncia da organização. ${ApiErrorMessage(org.error)}`);
    })();

    return () => { active = false; };
  }, [ready, orgId, eventId, viewerId, fetchCount]);

  if (auth.status === "error") return <ErrorAlert className="max-w-4xl mx-auto">{auth.message}</ErrorAlert>;
  if (ready && orgId === null) return <ErrorAlert className="max-w-4xl mx-auto">{MISSING_ORG_MESSAGE}</ErrorAlert>;
  if (load.kind === "loading") return <LoadingMessage>Carregando o evento...</LoadingMessage>;
  if (load.kind === "error") {
    return (
      <div className="column items-center gap-4 max-w-4xl mx-auto">
        <ErrorAlert className="w-full">{load.message}</ErrorAlert>
      </div>
    );
  }

  const { event, likes, threshold } = load;
  const org = event.organizationId;

  /** Applies a change to the likes of the loaded event. */
  const updateLikes = (change: (likes: Likes) => Likes) =>
    setLoad((current) => (current.kind === "ready" && current.likes !== null ? { ...current, likes: change(current.likes) } : current));

  const clearMessages = () => {
    setNotice("");
    setError("");
    setLoginPrompt(null);
  };

  const toggleLike = async () => {
    clearMessages();
    if (viewerId === null) return setLoginPrompt("curtir");
    if (likes === null || IsVoteInFlight(likes.pending)) return;

    const before = likes.pending;
    updateLikes((current) => ({ ...current, pending: StartVote(current.pending, current.viewerVoted) }));

    const answer = await api.events.vote(org, event.id);
    if (!answer.ok) {
      updateLikes((current) => ({ ...current, pending: before }));
      return setError(`Não foi possível registrar sua curtida. ${ApiErrorMessage(answer.error)}`);
    }
    const voted = answer.value.status === "voted";
    updateLikes((current) => ({
      ...current,
      viewerVoted: voted,
      pending: current.pending === undefined ? undefined : ConfirmVote(current.pending, voted, 0),
    }));

    const fresh = await fetchCount(org);
    if (!fresh.ok) return setError(fresh.message);
    setLoad((current) => current.kind === "ready"
      ? { ...current, likes: fresh.count === null ? null : { serverCount: fresh.count, viewerVoted: voted, pending: undefined } }
      : current);
  };

  const share = async () => {
    clearMessages();
    const url = window.location.href;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: event.title, text: `Confira o evento “${event.title}”`, url });
        return setNotice("Evento compartilhado.");
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === "AbortError") return setNotice("Compartilhamento cancelado.");
        return setError(`Não foi possível compartilhar: ${cause instanceof Error ? cause.message : String(cause)}`);
      }
    }
    if (navigator.clipboard === undefined) return setError(`Este navegador não permite copiar automaticamente. Copie o endereço: ${url}`);
    try {
      await navigator.clipboard.writeText(url);
      setNotice("Link do evento copiado para a área de transferência.");
    } catch (cause) {
      setError(`Não foi possível copiar o link (${cause instanceof Error ? cause.message : String(cause)}). Copie o endereço: ${url}`);
    }
  };

  const openReport = () => {
    clearMessages();
    if (viewerId === null) return setLoginPrompt("denunciar");
    setReportError("");
    setReporting(true);
  };

  const sendReport = async (data: ReportFormData) => {
    setReportSending(true);
    setReportError("");
    const answer = await api.events.report(org, event.id, data);
    setReportSending(false);
    if (!answer.ok) {
      if (answer.error.kind === "http" && answer.error.status === 400) {
        setReported(true);
        setReporting(false);
        return setError(ALREADY_REPORTED_MESSAGE);
      }
      return setReportError(`Não foi possível enviar a denúncia. ${ApiErrorMessage(answer.error)}`);
    }
    setReported(true);
    setReporting(false);
    setNotice("Denúncia enviada. Obrigado por ajudar a moderar o mural.");
  };

  const runConfirmed = async () => {
    if (confirm === null) return;
    setConfirmBusy(true);
    setConfirmError("");

    if (confirm === "delete") {
      const answer = await api.events.delete(org, event.id);
      setConfirmBusy(false);
      if (!answer.ok) return setConfirmError(ApiErrorMessage(answer.error));
      setConfirm(null);
      router.push("/");
      return;
    }

    const answer = event.isHidden ? await api.events.unhide(org, event.id) : await api.events.hide(org, event.id);
    setConfirmBusy(false);
    if (!answer.ok) return setConfirmError(ApiErrorMessage(answer.error));
    setConfirm(null);
    setLoad((current) => current.kind === "ready" ? { ...current, event: { ...current.event, isHidden: answer.value.isHidden } } : current);
    setNotice(answer.value.isHidden ? "Evento ocultado do mural." : "Evento visível no mural novamente.");
  };

  return (
    <>
      <EventDetails
        event={event}
        likes={likes === null ? null : ShownVoteFor(likes.serverCount, likes.viewerVoted, likes.pending)}
        likeBusy={likes !== null && IsVoteInFlight(likes.pending)}
        canModerate={CanModerate(user, org)}
        isCreator={viewerId !== null && event.creatorId === viewerId}
        reported={reported}
        loginPrompt={loginPrompt}
        loginRedirect={`/eventos/${event.id}`}
        notice={notice}
        error={error}
        onToggleLike={() => void toggleLike()}
        onShare={() => void share()}
        onReport={openReport}
        onHide={() => { clearMessages(); setConfirmError(""); setConfirm("hide"); }}
        onUnhide={() => { clearMessages(); setConfirmError(""); setConfirm("hide"); }}
        onDelete={() => { clearMessages(); setConfirmError(""); setConfirm("delete"); }}
      />

      <Drawer isOpen={reporting} onClose={() => { if (!reportSending) setReporting(false); }} title="Denunciar evento">
        <ReportForm
          threshold={threshold}
          isSending={reportSending}
          error={reportError}
          onSubmit={(data) => void sendReport(data)}
          onCancel={() => setReporting(false)}
        />
      </Drawer>

      <ConfirmDialog
        isOpen={confirm !== null}
        title={confirm === "delete" ? "Excluir este evento?" : event.isHidden ? "Reexibir este evento?" : "Ocultar este evento?"}
        confirmLabel={confirm === "delete" ? "Sim, excluir" : event.isHidden ? "Sim, reexibir" : "Sim, ocultar"}
        danger={confirm === "delete" || !event.isHidden}
        busy={confirmBusy}
        error={confirmError}
        onConfirm={() => void runConfirmed()}
        onCancel={() => setConfirm(null)}
      >
        {confirm === "delete"
          ? "O evento sai do mural e dos totens. Esta ação não pode ser desfeita."
          : event.isHidden
            ? "O evento volta a aparecer no mural e nos totens."
            : "O evento deixa de aparecer no mural e nos totens até ser reexibido. A ação fica registrada na auditoria."}
      </ConfirmDialog>
    </>
  );
}
