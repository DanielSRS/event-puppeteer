/**
 * Moderation queue page (Moderator+): loads the organization's reports,
 * groups them by event and loads each reported event with
 * `GET .../events/:id`, which also answers for hidden events, so the title and
 * the visibility shown are always the real ones (even after an automatic hide),
 * along with the event's banner for the card's thumbnail. The page header is
 * drawn by the route, above every state of the queue.
 *
 * @module
 */

"use client";

import { useState } from "react";
import { api, ApiErrorMessage } from "@/lib/api/client";
import type { Event } from "@/lib/api/schemas";
import { Err, Ok, type Result } from "@/lib/result";
import { Freshness } from "@/lib/query/options";
import { LoadedQuery } from "@/lib/query/loaded";
import { useLoaded } from "@/lib/query/useLoaded";
import { ErrorAlert, LoadingMessage, StatusMessage } from "@/components/ui/Feedback";
import { SectionDenialFor, SelectOrgNotice, useDashboard } from "../DashboardContext";
import { AccessNotice } from "../global/AccessNotice";
import { GroupReports } from "./reportGroups";
import { ReportList, type ReportedEvent, type ReportQueueItem } from "./ReportList";

/** What the queue knows about an event loaded from the API. */
function ToReportedEvent(event: Event): ReportedEvent {
  const loaded: Extract<ReportedEvent, { kind: "loaded" }> = { kind: "loaded", title: event.title, isHidden: event.isHidden, isDeleted: event.isDeleted };
  return event.banner === undefined ? loaded : { ...loaded, banner: event.banner };
}

/** Loads the reports of `orgId` and every reported event. */
async function LoadQueue(orgId: string): Promise<Result<ReportQueueItem[], string>> {
  const reports = await api.moderation.listReports(orgId);
  if (!reports.ok) return Err(`Não foi possível carregar as denúncias. ${ApiErrorMessage(reports.error)}`);

  const groups = GroupReports(reports.value);
  const events = await Promise.all(groups.map((group) => api.events.get(orgId, group.eventId)));

  return Ok(groups.map((group, index): ReportQueueItem => {
    const event = events[index];
    return {
      ...group,
      event: event.ok
        ? ToReportedEvent(event.value)
        : { kind: "error", message: `Não foi possível carregar este evento. ${ApiErrorMessage(event.error)}` },
    };
  }));
}

/** The moderation queue of `orgId`. */
export const reportQueueQuery = (orgId: string) =>
  LoadedQuery(["dashboard", "reports", orgId], () => LoadQueue(orgId), Freshness.live);

/** The page, guarded by the section rules. */
export function DashboardReportsContainer() {
  const { user, orgId } = useDashboard();
  const denial = SectionDenialFor("reports", user, orgId);
  if (denial !== null) return <AccessNotice denial={denial} />;
  if (orgId === null) return <SelectOrgNotice />;
  return <ReportQueue key={orgId} orgId={orgId} />;
}

/** The queue of one organization; remounted when the organization changes. */
function ReportQueue({ orgId }: { orgId: string }) {
  const loaded = useLoaded(reportQueueQuery(orgId));
  const queue = loaded.result;
  const [busyEventId, setBusyEventId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const handleSetHidden = async (eventId: string, hidden: boolean) => {
    setBusyEventId(eventId);
    setFeedback(null);
    const result = hidden ? await api.events.hide(orgId, eventId) : await api.events.unhide(orgId, eventId);
    setBusyEventId(null);

    if (!result.ok) {
      setFeedback({ ok: false, text: `Não foi possível ${hidden ? "ocultar" : "reexibir"} o evento. ${ApiErrorMessage(result.error)}` });
      return;
    }

    const updated = result.value;
    loaded.update((items) => items.map((item) => item.eventId === eventId ? { ...item, event: ToReportedEvent(updated) } : item));
    setFeedback({
      ok: true,
      text: updated.isHidden ? `“${updated.title}” foi ocultado do mural.` : `“${updated.title}” voltou a aparecer no mural.`,
    });
  };

  if (queue === null) return <LoadingMessage>Carregando denúncias...</LoadingMessage>;
  if (!queue.ok) return <ErrorAlert>{queue.error}</ErrorAlert>;

  return (
    <div className="column gap-[22px]">
      {feedback !== null && (feedback.ok ? <StatusMessage>{feedback.text}</StatusMessage> : <ErrorAlert>{feedback.text}</ErrorAlert>)}
      <ReportList items={queue.value} busyEventId={busyEventId} onSetHidden={handleSetHidden} />
    </div>
  );
}
