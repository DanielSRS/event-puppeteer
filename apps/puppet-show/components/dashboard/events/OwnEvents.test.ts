/**
 * Status and ordering of the events in "Meus Eventos".
 *
 * @module
 */

import { describe, expect, test } from "vitest";
import type { Event } from "@/lib/api/schemas";
import { ToOwnEvent } from "./OwnEvents";

const TODAY = "2026-10-08";

/** An event with the given days and visibility. */
function Make(dates: string[], isHidden = false): Event {
  return {
    id: "e1",
    title: "Feira",
    description: "Descrição da feira.",
    location: "Pavilhão",
    creatorId: "u1",
    organizationId: "o1",
    isHidden,
    isDeleted: false,
    createdAt: "2026-10-01T00:00:00.000Z",
    schedule: dates.map((date) => ({ eventId: "e1", date, startTime: "09:00" })),
    tags: [],
    links: [],
  };
}

describe("ToOwnEvent", () => {
  test("an upcoming visible event is active", () => {
    expect(ToOwnEvent(Make(["2026-10-10"]), TODAY).status).toBe("active");
  });

  test("an event happening today is still active", () => {
    expect(ToOwnEvent(Make([TODAY]), TODAY).status).toBe("active");
  });

  test("an event whose days are all over is past", () => {
    expect(ToOwnEvent(Make(["2026-10-01", "2026-10-07"]), TODAY).status).toBe("past");
  });

  test("a multi-day event with a day left is active", () => {
    expect(ToOwnEvent(Make(["2026-10-07", "2026-10-09"]), TODAY).status).toBe("active");
  });

  test("hidden wins over past", () => {
    expect(ToOwnEvent(Make(["2026-10-01"], true), TODAY).status).toBe("hidden");
    expect(ToOwnEvent(Make(["2026-10-10"], true), TODAY).status).toBe("hidden");
  });

  test("days come out in date order without the event id", () => {
    expect(ToOwnEvent(Make(["2026-10-12", "2026-10-10"]), TODAY).days).toEqual([
      { date: "2026-10-10", startTime: "09:00", endTime: undefined },
      { date: "2026-10-12", startTime: "09:00", endTime: undefined },
    ]);
  });
});
