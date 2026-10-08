/**
 * Turns the flat list of reports from `GET /organizations/:id/reports` into
 * the moderation queue: one entry per reported event, with how many reports
 * it got, why, the comments and when.
 *
 * @module
 */

import type { Report, ReportReason } from "@/lib/api/schemas";

/** Portuguese label of each report reason. */
export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  spam: "Spam",
  offensive_content: "Conteúdo ofensivo",
  incorrect_information: "Informação incorreta",
  duplicate: "Duplicado",
};

/** How many reports gave one reason. */
export type ReasonCount = { reason: ReportReason; count: number };

/** A comment left by a reporter, with when it was sent. */
export type ReportComment = { id: string; comment: string; createdAt: string };

/** Every report about one event. */
export type ReportGroup = {
  eventId: string;
  /** Number of reports. */
  count: number;
  /** Reasons, most frequent first. */
  reasons: ReasonCount[];
  /** Comments that were actually written, newest first. */
  comments: ReportComment[];
  /** When the first report arrived. */
  firstReportedAt: string;
  /** When the latest report arrived. */
  lastReportedAt: string;
};

/**
 * Groups reports by event. Events with more reports come first; ties go to
 * the most recently reported one.
 */
export function GroupReports(reports: readonly Report[]): ReportGroup[] {
  const byEvent = new Map<string, Report[]>();
  for (const report of reports) {
    const list = byEvent.get(report.eventId);
    if (list === undefined) byEvent.set(report.eventId, [report]);
    else list.push(report);
  }

  const groups: ReportGroup[] = [];
  for (const [eventId, list] of byEvent) {
    const sorted = [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    const reasonCounts = new Map<ReportReason, number>();
    for (const report of sorted) {
      const seen = reasonCounts.get(report.reason);
      reasonCounts.set(report.reason, seen === undefined ? 1 : seen + 1);
    }
    const reasons = [...reasonCounts].map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason));

    const comments: ReportComment[] = [];
    for (const report of [...sorted].reverse()) {
      const text = report.comment?.trim();
      if (text) comments.push({ id: report.id, comment: text, createdAt: report.createdAt });
    }

    groups.push({
      eventId,
      count: sorted.length,
      reasons,
      comments,
      firstReportedAt: sorted[0].createdAt,
      lastReportedAt: sorted[sorted.length - 1].createdAt,
    });
  }

  return groups.sort((a, b) => b.count - a.count || b.lastReportedAt.localeCompare(a.lastReportedAt));
}

/** `1 denúncia` / `3 denúncias`. */
export function ReportCountLabel(count: number): string {
  return count === 1 ? "1 denúncia" : `${count} denúncias`;
}
