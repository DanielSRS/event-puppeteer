import { describe, expect, test } from "vitest";
import type { Report } from "@/lib/api/schemas";
import { GroupReports, ReportCountLabel } from "./reportGroups";

/** A report with the fields the grouping looks at. */
function report(id: string, eventId: string, createdAt: string, reason: Report["reason"], comment?: string): Report {
  return { id, reporterId: `u-${id}`, eventId, reason, createdAt, ...(comment !== undefined ? { comment } : {}) };
}

describe("GroupReports", () => {
  test("no reports, no groups", () => expect(GroupReports([])).toEqual([]));

  test("groups by event with counts, reasons, comments and dates", () => {
    const groups = GroupReports([
      report("1", "a", "2026-10-01T10:00:00Z", "spam", "Propaganda"),
      report("2", "b", "2026-10-02T10:00:00Z", "duplicate"),
      report("3", "a", "2026-10-03T10:00:00Z", "offensive_content", "  "),
      report("4", "a", "2026-10-02T10:00:00Z", "spam", "Repetido"),
    ]);

    expect(groups).toEqual([
      {
        eventId: "a",
        count: 3,
        reasons: [{ reason: "spam", count: 2 }, { reason: "offensive_content", count: 1 }],
        comments: [
          { id: "4", comment: "Repetido", createdAt: "2026-10-02T10:00:00Z" },
          { id: "1", comment: "Propaganda", createdAt: "2026-10-01T10:00:00Z" },
        ],
        firstReportedAt: "2026-10-01T10:00:00Z",
        lastReportedAt: "2026-10-03T10:00:00Z",
      },
      {
        eventId: "b",
        count: 1,
        reasons: [{ reason: "duplicate", count: 1 }],
        comments: [],
        firstReportedAt: "2026-10-02T10:00:00Z",
        lastReportedAt: "2026-10-02T10:00:00Z",
      },
    ]);
  });

  test("ties in count go to the most recently reported event", () => {
    const groups = GroupReports([
      report("1", "old", "2026-10-01T10:00:00Z", "spam"),
      report("2", "new", "2026-10-05T10:00:00Z", "spam"),
    ]);
    expect(groups.map((g) => g.eventId)).toEqual(["new", "old"]);
  });
});

describe("ReportCountLabel", () => {
  test("singular and plural", () => {
    expect(ReportCountLabel(1)).toBe("1 denúncia");
    expect(ReportCountLabel(4)).toBe("4 denúncias");
  });
});
