import { describe, expect, test } from "vitest";
import { NextWindowIndex, TvWindows, ValidWindowIndex, WindowDurationMs } from "./tv";

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
