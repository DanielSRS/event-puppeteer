/**
 * Loads one event and wires the details page actions to the API.
 *
 * @module
 */

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ErrorAlert, LoadingMessage } from "@/components/ui/Feedback";
import { useAuth } from "@/hooks/useAuth";
import { FeedOrgId } from "@/hooks/useEvents";
import { api, ApiErrorMessage, type ApiError } from "@/lib/api/client";
import { MISSING_ORG_MESSAGE } from "@/lib/api/session";
import { UserOrgId, type EventWithVotes, type LinkLabel, type Tag, type User } from "@/lib/api/schemas";
import { ToEventDetail, type EventDetail } from "@/lib/api/mappers";
import { ConfirmVote, IsVoteInFlight, ShownVoteFor, StartVote, type PendingVote } from "@/domain/likes";
import {
  eventQuery, feedQuery, linkLabelsQuery, organizationQuery, ownEventsKey, reportStatusQuery, tagsQuery, voteStatusQuery,
} from "@/lib/query/queries";
import { useApiQuery, type ApiData } from "@/lib/query/useApiQuery";
import { Ok } from "@/lib/result";
import { TodayInBrazil } from "@/utils/date";
import { EventDetails, type LoginPrompt } from "./EventDetails";
import { ReportDialog } from "./report-dialog";
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

/** The likes the details page knows: the server's count plus the viewer's vote. */
type Likes = { serverCount: number; viewerVoted: boolean; pending: PendingVote | undefined };

/**
 * The message to show when the page can't be built, or `null` when nothing is
 * missing for a reason other than still loading. A refresh that failed while
 * older data is shown is not a failure here.
 */
function LoadFailure(
  event: ApiError | null,
  eventValue: unknown,
  tags: ApiData<Tag[]>,
  labels: ApiData<LinkLabel[]>,
  vote: ApiData<{ voted: boolean }>,
  report: ApiData<{ reported: boolean }>,
  loggedIn: boolean,
): string | null {
  if (event !== null && eventValue === null) {
    const notFound = event.kind === "http" && event.status === 404;
    return notFound ? UNAVAILABLE_MESSAGE : ApiErrorMessage(event);
  }
  if (tags.error !== null && tags.value === null) return `Não foi possível carregar as categorias. ${ApiErrorMessage(tags.error)}`;
  if (labels.error !== null && labels.value === null) return `Não foi possível carregar os links. ${ApiErrorMessage(labels.error)}`;
  if (!loggedIn) return null;
  if (vote.error !== null && vote.value === null) return `Não foi possível saber se você curtiu este evento. ${ApiErrorMessage(vote.error)}`;
  if (report.error !== null && report.value === null) return `Não foi possível saber se você já denunciou este evento. ${ApiErrorMessage(report.error)}`;
  return null;
}

/** Which confirmation is open. */
type Confirm = "hide" | "delete" | null;

/**
 * Fetches the event (with its vote count) and the tag and link-label catalogs
 * (for names), the organization's report threshold and, for a logged-in
 * viewer, whether they liked and whether they already reported it.
 */
export function EventDetailsContainer({ eventId }: EventDetailsContainerProps) {
  const router = useRouter();
  const client = useQueryClient();
  const { state: auth, user } = useAuth();
  const orgId = FeedOrgId(user);
  const viewerId = user === null ? null : user.id;
  const ready = auth.status === "anonymous" || auth.status === "authenticated";
  const enabled = ready && orgId !== null;
  const scope = orgId === null ? "" : orgId;

  const event = useApiQuery(eventQuery(scope, eventId), { enabled });
  const tags = useApiQuery(tagsQuery());
  const labels = useApiQuery(linkLabelsQuery());
  const organization = useApiQuery(organizationQuery(scope), { enabled });
  const vote = useApiQuery(voteStatusQuery(scope, eventId), { enabled: enabled && viewerId !== null });
  const report = useApiQuery(reportStatusQuery(scope, eventId), { enabled: enabled && viewerId !== null });

  /** Set once the event was deleted; its cached answer is dropped when the page goes away. */
  const deletedRef = useRef(false);
  const [pendingVote, setPendingVote] = useState<PendingVote | undefined>(undefined);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loginPrompt, setLoginPrompt] = useState<LoginPrompt | null>(null);
  const [reporting, setReporting] = useState(false);
  const [reportSending, setReportSending] = useState(false);
  const [reportError, setReportError] = useState("");
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmError, setConfirmError] = useState("");
  const [bannerBusy, setBannerBusy] = useState(false);

  const detail = useMemo(
    () => (event.value === null || tags.value === null || labels.value === null
      ? null
      : ToEventDetail(event.value, tags.value, labels.value)),
    [event.value, tags.value, labels.value],
  );

  const eventKey = eventQuery(scope, eventId).queryKey;
  const feedKey = feedQuery(scope).queryKey;

  useEffect(() => () => {
    if (deletedRef.current) client.removeQueries({ queryKey: eventQuery(scope, eventId).queryKey });
  }, [client, scope, eventId]);

  /** Applies a change to the cached event, so every screen showing it agrees. */
  const changeEvent = (change: (current: EventWithVotes) => EventWithVotes) =>
    client.setQueryData(eventKey, (current) => (current !== undefined && current.ok ? Ok(change(current.value)) : current));

  if (auth.status === "error") return <ErrorAlert className="w-full">{auth.message}</ErrorAlert>;
  if (ready && orgId === null) return <ErrorAlert className="w-full">{MISSING_ORG_MESSAGE}</ErrorAlert>;

  const failure = LoadFailure(event.error, event.value, tags, labels, vote, report, viewerId !== null);
  if (failure !== null) {
    return (
      <div className="column w-full items-center gap-4">
        <ErrorAlert className="w-full">{failure}</ErrorAlert>
      </div>
    );
  }
  if (detail === null || event.value === null || (viewerId !== null && (vote.value === null || report.value === null)))
    return <LoadingMessage>Carregando o evento...</LoadingMessage>;

  const org = detail.organizationId;
  const likes: Likes = { serverCount: event.value.voteCount, viewerVoted: vote.value === null ? false : vote.value.voted, pending: pendingVote };
  const threshold = organization.value === null ? null : organization.value.shadowBanThreshold;
  const reported = report.value !== null && report.value.reported;
  const organizationError = organization.error === null
    ? ""
    : `Não foi possível carregar as regras de denúncia da organização. ${ApiErrorMessage(organization.error)}`;

  const clearMessages = () => {
    setNotice("");
    setError("");
    setLoginPrompt(null);
  };

  const toggleLike = async () => {
    clearMessages();
    if (viewerId === null) return setLoginPrompt("curtir");
    if (IsVoteInFlight(likes.pending)) return;

    const before = likes.pending;
    setPendingVote(StartVote(before, likes.viewerVoted));

    const answer = await api.events.vote(org, detail.id);
    if (!answer.ok) {
      setPendingVote(before);
      return setError(`Não foi possível registrar sua curtida. ${ApiErrorMessage(answer.error)}`);
    }
    const voted = answer.value.status === "voted";
    client.setQueryData(voteStatusQuery(org, detail.id).queryKey, Ok({ voted }));
    setPendingVote((current) => (current === undefined ? undefined : ConfirmVote(current, voted, 0)));

    const fresh = await api.events.get(org, detail.id);
    if (!fresh.ok) return setError(`Não foi possível atualizar as curtidas. ${ApiErrorMessage(fresh.error)}`);
    client.setQueryData(eventKey, Ok(fresh.value));
    setPendingVote(undefined);
    void client.invalidateQueries({ queryKey: feedKey });
  };

  const share = async () => {
    clearMessages();
    const url = window.location.href;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: detail.title, text: `Confira o evento “${detail.title}”`, url });
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
    const answer = await api.events.report(org, detail.id, data);
    setReportSending(false);
    if (!answer.ok) {
      if (answer.error.kind === "http" && answer.error.status === 400) {
        client.setQueryData(reportStatusQuery(org, detail.id).queryKey, Ok({ reported: true }));
        setReporting(false);
        return setError(ALREADY_REPORTED_MESSAGE);
      }
      return setReportError(`Não foi possível enviar a denúncia. ${ApiErrorMessage(answer.error)}`);
    }
    client.setQueryData(reportStatusQuery(org, detail.id).queryKey, Ok({ reported: true }));
    setReporting(false);
    setNotice("Denúncia enviada. Obrigado por ajudar a moderar o mural.");
  };

  /** Applies the banner as the API now answers it to the loaded event. */
  const showBanner = (banner: EventDetail["banner"]) =>
    changeEvent((current) => ({ ...current, banner: banner === null ? undefined : banner }));

  const replaceBanner = async (picture: Blob) => {
    clearMessages();
    setBannerBusy(true);
    const answer = await api.images.uploadBanner(org, detail.id, picture);
    setBannerBusy(false);
    if (!answer.ok) return setError(`Não foi possível enviar o banner. ${ApiErrorMessage(answer.error)}`);
    showBanner(answer.value);
    setNotice("Banner atualizado.");
  };

  const removeBanner = async () => {
    clearMessages();
    setBannerBusy(true);
    const answer = await api.images.removeBanner(org, detail.id);
    setBannerBusy(false);
    if (!answer.ok) return setError(`Não foi possível remover o banner. ${ApiErrorMessage(answer.error)}`);
    showBanner(null);
    setNotice("Banner removido.");
  };

  const runConfirmed = async () => {
    if (confirm === null) return;
    setConfirmBusy(true);
    setConfirmError("");

    if (confirm === "delete") {
      const answer = await api.events.delete(org, detail.id);
      setConfirmBusy(false);
      if (!answer.ok) return setConfirmError(ApiErrorMessage(answer.error));
      setConfirm(null);
      deletedRef.current = true;
      void client.invalidateQueries({ queryKey: feedKey });
      void client.invalidateQueries({ queryKey: ownEventsKey(org) });
      router.push("/");
      return;
    }

    const answer = detail.isHidden ? await api.events.unhide(org, detail.id) : await api.events.hide(org, detail.id);
    setConfirmBusy(false);
    if (!answer.ok) return setConfirmError(ApiErrorMessage(answer.error));
    setConfirm(null);
    changeEvent((current) => ({ ...current, isHidden: answer.value.isHidden }));
    void client.invalidateQueries({ queryKey: feedKey });
    setNotice(answer.value.isHidden ? "Evento ocultado do mural." : "Evento visível no mural novamente.");
  };

  return (
    <>
      <EventDetails
        event={detail}
        likes={ShownVoteFor(likes.serverCount, likes.viewerVoted, likes.pending)}
        likeBusy={IsVoteInFlight(likes.pending)}
        canModerate={CanModerate(user, org)}
        isCreator={viewerId !== null && detail.creatorId === viewerId}
        canDelete={(viewerId !== null && detail.creatorId === viewerId) || (user !== null && user.role === "Superadmin")}
        reported={reported}
        loginPrompt={loginPrompt}
        loginRedirect={`/eventos/${detail.id}`}
        notice={notice}
        error={error === "" ? organizationError : error}
        onToggleLike={() => void toggleLike()}
        onShare={() => void share()}
        onReport={openReport}
        onHide={() => { clearMessages(); setConfirmError(""); setConfirm("hide"); }}
        onUnhide={() => { clearMessages(); setConfirmError(""); setConfirm("hide"); }}
        onDelete={() => { clearMessages(); setConfirmError(""); setConfirm("delete"); }}
        bannerBusy={bannerBusy}
        onReplaceBanner={(picture) => void replaceBanner(picture)}
        onRemoveBanner={() => void removeBanner()}
        today={TodayInBrazil()}
      />

      <ReportDialog isOpen={reporting} onClose={() => { if (!reportSending) setReporting(false); }} eventTitle={detail.title}>
        <ReportForm
          threshold={threshold}
          isSending={reportSending}
          error={reportError}
          onSubmit={(data) => void sendReport(data)}
          onCancel={() => setReporting(false)}
        />
      </ReportDialog>

      <ConfirmDialog
        isOpen={confirm !== null}
        title={confirm === "delete" ? "Excluir este evento?" : detail.isHidden ? "Reexibir este evento?" : "Ocultar este evento?"}
        confirmLabel={confirm === "delete" ? "Sim, excluir" : detail.isHidden ? "Sim, reexibir" : "Sim, ocultar"}
        danger={confirm === "delete" || !detail.isHidden}
        busy={confirmBusy}
        error={confirmError}
        onConfirm={() => void runConfirmed()}
        onCancel={() => setConfirm(null)}
      >
        {confirm === "delete"
          ? "O evento sai do mural e dos totens. Esta ação não pode ser desfeita."
          : detail.isHidden
            ? "O evento volta a aparecer no mural e nos totens."
            : "O evento deixa de aparecer no mural e nos totens até ser reexibido. A ação fica registrada na auditoria."}
      </ConfirmDialog>
    </>
  );
}
