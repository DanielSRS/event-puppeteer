/**
 * Moderation queue page (Moderator+): loads the organization's reports,
 * groups them by event and loads each reported event with
 * `GET .../events/:id`, which also answers for hidden events, so the title and
 * the visibility shown are always the real ones (even after an automatic hide).
 *
 * @module
 */

"use client";

import { useEffect, useState } from "react";
import { api, ApiErrorMessage } from "@/lib/api/client";
import type { Event } from "@/lib/api/schemas";
import { Err, Ok, type Result } from "@/lib/result";
import { ErrorAlert, LoadingMessage, StatusMessage } from "@/components/ui/Feedback";
import { SectionDenialFor, SelectOrgNotice, useDashboard } from "../DashboardContext";
import { AccessNotice } from "../global/AccessNotice";
import { GroupReports } from "./reportGroups";
import { ReportList, type ReportedEvent, type ReportQueueItem } from "./ReportList";

/** What the queue knows about an event loaded from the API. */
function ToReportedEvent(event: Event): ReportedEvent {
  return { kind: "loaded", title: event.title, isHidden: event.isHidden, isDeleted: event.isDeleted };
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
  const [queue, setQueue] = useState<Result<ReportQueueItem[], string> | null>(null);
  const [busyEventId, setBusyEventId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let active = true;
    LoadQueue(orgId).then((result) => { if (active) setQueue(result); });
    return () => { active = false; };
  }, [orgId]);

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
    setQueue((current) => current !== null && current.ok
      ? Ok(current.value.map((item) => item.eventId === eventId ? { ...item, event: ToReportedEvent(updated) } : item))
      : current);
    setFeedback({
      ok: true,
      text: updated.isHidden ? `“${updated.title}” foi ocultado do mural.` : `“${updated.title}” voltou a aparecer no mural.`,
    });
  };

  if (queue === null) return <LoadingMessage>Carregando denúncias...</LoadingMessage>;
  if (!queue.ok) return <ErrorAlert>{queue.error}</ErrorAlert>;

  return (
    <div className="column gap-4">
      {feedback !== null && (feedback.ok ? <StatusMessage>{feedback.text}</StatusMessage> : <ErrorAlert>{feedback.text}</ErrorAlert>)}
      <ReportList items={queue.value} busyEventId={busyEventId} onSetHidden={handleSetHidden} />
    </div>
  );
}
