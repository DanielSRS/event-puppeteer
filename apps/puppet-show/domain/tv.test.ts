import { describe, expect, test } from "vitest";
import { AgendaOrder, HotEventId, NextAfterToday, NextWindowIndex, RelativeDay, RotationCycle, TodaysEvents, TvWindows, ValidWindowIndex, WeekSummary, WindowDurationMs } from "./tv";

describe("TvWindows", () => {
  test("splits into windows of three", () => {
    expect(TvWindows([1, 2, 3, 4, 5, 6, 7])).toEqual([[1, 2, 3], [4, 5, 6], [7]]);
  });

  test("three or fewer events make one window, nothing repeated", () => {
    expect(TvWindows([1, 2])).toEqual([[1, 2]]);
    expect(TvWindows([1, 2, 3])).toEqual([[1, 2, 3]]);
    expect(TvWindows([])).toEqual([]);
  });
});

describe("WindowDurationMs", () => {
  test("15 s plus 1 s per vote in the window", () => {
    expect(WindowDurationMs([{ voteCount: 0 }])).toBe(15_000);
    expect(WindowDurationMs([{ voteCount: 2 }, { voteCount: 5 }, { voteCount: 0 }])).toBe(22_000);
    expect(WindowDurationMs([])).toBe(15_000);
  });
});

describe("rotation", () => {
  test("advances and wraps", () => {
    expect(NextWindowIndex(0, 3)).toBe(1);
    expect(NextWindowIndex(2, 3)).toBe(0);
  });

  test("a single window never moves", () => {
    expect(NextWindowIndex(0, 1)).toBe(0);
    expect(NextWindowIndex(0, 0)).toBe(0);
  });

  test("a shrunken feed restarts at the first window", () => {
    expect(NextWindowIndex(5, 2)).toBe(0);
    expect(ValidWindowIndex(2, 2)).toBe(0);
    expect(ValidWindowIndex(1, 2)).toBe(1);
  });
});

function Ev(id: string, days: Array<[string, string?]>, voteCount = 0, tags: string[] = []) {
  return { id, voteCount, schedule: days.map(([date, startTime]) => ({ date, startTime })), tags: tags.map((tag) => ({ id: tag })) };
}

describe("featured rotation", () => {
  test("windows of one show every event once", () => {
    expect(TvWindows([1, 2, 3], 1)).toEqual([[1], [2], [3]]);
  });
});

describe("agenda helpers", () => {
  const today = "2026-10-14";
  const events = [
    Ev("late", [["2026-10-20", "09:00"]], 3, ["t1"]),
    Ev("today-afternoon", [["2026-10-14", "14:00"]], 0, ["t2"]),
    Ev("today-morning", [["2026-10-14", "08:00"]], 7, ["t1"]),
    Ev("tomorrow", [["2026-10-15"]], 2),
  ];

  test("calendar order uses the featured day and start time", () => {
    expect(AgendaOrder(events, today).map((e) => e.id)).toEqual(["today-morning", "today-afternoon", "tomorrow", "late"]);
  });

  test("today's events and the next one after today", () => {
    expect(TodaysEvents(events, today).map((e) => e.id)).toEqual(["today-morning", "today-afternoon"]);
    expect(NextAfterToday(events, today)?.id).toBe("tomorrow");
    expect(NextAfterToday([events[1]], today)).toBeNull();
  });

  test("the next seven days count events and distinct tags", () => {
    expect(WeekSummary(events, today)).toEqual({ events: 4, categories: 2 });
    expect(WeekSummary(events, "2026-10-08")).toEqual({ events: 3, categories: 2 });
  });

  test("the most liked event is hot only with likes", () => {
    expect(HotEventId(events)).toBe("today-morning");
    expect(HotEventId([Ev("a", [], 0)])).toBeNull();
  });

  test("relative day names", () => {
    expect(RelativeDay("2026-10-14", today)).toBe("hoje");
    expect(RelativeDay("2026-10-15", today)).toBe("amanhã");
    expect(RelativeDay("2026-10-17", today)).toBe("sáb, 17 out");
  });
});

describe("RotationCycle", () => {
  const today = "2026-10-14";

  test("equal priorities rotate 1:1", () => {
    const cycle = RotationCycle([Ev("a", [["2026-10-30"]]), Ev("b", [["2026-10-30"]]), Ev("c", [["2026-10-30"]])], today);
    expect(cycle.map((e) => e.id)).toEqual(["a", "b", "c"]);
  });

  test("the top event comes back between the others, distant unliked ones show once", () => {
    const events = [
      Ev("hot-soon", [["2026-10-15"]], 20),
      Ev("far-1", [["2026-11-20"]]),
      Ev("far-2", [["2026-11-21"]]),
      Ev("far-3", [["2026-11-22"]]),
    ];
    const ids = RotationCycle(events, today).map((e) => e.id);
    expect(ids.filter((id) => id === "hot-soon")).toHaveLength(3);
    for (const far of ["far-1", "far-2", "far-3"]) expect(ids.filter((id) => id === far)).toHaveLength(1);
    // The cycle loops: no event twice in a row, including from the last to the first.
    for (let i = 0; i < ids.length; i++) expect(ids[(i + 1) % ids.length]).not.toBe(ids[i]);
  });

  test("one or no event", () => {
    expect(RotationCycle([], today)).toEqual([]);
    expect(RotationCycle([Ev("a", [])], today).map((e) => e.id)).toEqual(["a"]);
  });
});
