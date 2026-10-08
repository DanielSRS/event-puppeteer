import { describe, expect, test } from "vitest";
import { DateBadge, DaysBetween, FeaturedDay, FullDate, MultiDayLabel, NextDay, ShortDate, SortedDays, TimeRange } from "./schedule";
import { ElapsedLabel, FromISODate, LongDate, TodayInBrazil } from "@/utils/date";

describe("DateBadge", () => {
  test("splits a date into day and short month", () => {
    expect(DateBadge("2026-10-05")).toEqual({ day: "05", month: "out" });
    expect(DateBadge("2026-01-31")).toEqual({ day: "31", month: "jan" });
  });

  test("rejects anything that isn't YYYY-MM-DD", () => {
    expect(DateBadge("05/10/2026")).toBeNull();
    expect(DateBadge("2026-13-01")).toBeNull();
  });
});

describe("TimeRange", () => {
  test("start and end", () => expect(TimeRange({ date: "2026-10-05", startTime: "14:00", endTime: "16:00" })).toBe("14:00 – 16:00"));
  test("start only", () => expect(TimeRange({ date: "2026-10-05", startTime: "09:00" })).toBe("A partir das 09:00"));
  test("no times is all day", () => expect(TimeRange({ date: "2026-10-05" })).toBe("Dia todo"));
});

describe("MultiDayLabel", () => {
  test("single day has no label", () => {
    expect(MultiDayLabel([{ date: "2026-10-05" }])).toBeNull();
    expect(MultiDayLabel([])).toBeNull();
  });

  test("consecutive days are counted, whatever the input order", () => {
    expect(MultiDayLabel([{ date: "2026-10-07" }, { date: "2026-10-05" }, { date: "2026-10-06" }])).toBe("3 dias");
  });

  test("consecutive across a month boundary", () => {
    expect(MultiDayLabel([{ date: "2026-10-31" }, { date: "2026-11-01" }])).toBe("2 dias");
  });

  test("days with gaps show the range", () => {
    expect(MultiDayLabel([{ date: "2026-10-05" }, { date: "2026-10-20" }])).toBe("05 out – 20 out");
  });
});

describe("NextDay", () => {
  const schedule = [{ date: "2026-10-07" }, { date: "2026-10-05" }, { date: "2026-10-06" }];

  test("first day on or after today", () => {
    expect(NextDay(schedule, "2026-10-06")).toEqual({ date: "2026-10-06" });
    expect(NextDay(schedule, "2026-10-01")).toEqual({ date: "2026-10-05" });
  });

  test("null when every day is past", () => {
    expect(NextDay(schedule, "2026-10-08")).toBeNull();
  });
});

describe("dates", () => {
  test("SortedDays leaves the input untouched", () => {
    const input = [{ date: "2026-10-07" }, { date: "2026-10-05" }];
    expect(SortedDays(input).map((d) => d.date)).toEqual(["2026-10-05", "2026-10-07"]);
    expect(input[0].date).toBe("2026-10-07");
  });

  test("DaysBetween", () => {
    expect(DaysBetween("2026-02-27", "2026-03-01")).toBe(2);
    expect(DaysBetween("x", "2026-03-01")).toBeNull();
  });

  test("ShortDate / FullDate / FromISODate / LongDate", () => {
    expect(ShortDate("2026-10-15")).toBe("15 out");
    expect(FullDate("2026-10-15")).toBe("quinta-feira, 15 de outubro de 2026");
    expect(FromISODate("2026-10-15")).toBe("15/10/2026");
    expect(LongDate("2026-10-15")).toBe("quinta-feira, 15 de outubro");
  });

  test("TodayInBrazil uses the Sao Paulo time zone", () => {
    expect(TodayInBrazil(new Date("2026-10-08T02:00:00Z"))).toBe("2026-10-07");
    expect(TodayInBrazil(new Date("2026-10-08T12:00:00Z"))).toBe("2026-10-08");
  });

  test("ElapsedLabel", () => {
    expect(ElapsedLabel(1000, 1500)).toBe("agora");
    expect(ElapsedLabel(0, 5000)).toBe("5 s");
    expect(ElapsedLabel(0, 125_000)).toBe("2 min");
  });
});

describe("FeaturedDay", () => {
  test("next day, else the last one, else null", () => {
    const schedule = [{ date: "2026-10-05" }, { date: "2026-10-07" }];
    expect(FeaturedDay(schedule, "2026-10-06")).toEqual({ date: "2026-10-07" });
    expect(FeaturedDay(schedule, "2026-10-09")).toEqual({ date: "2026-10-07" });
    expect(FeaturedDay([], "2026-10-09")).toBeNull();
  });
});
