import { describe, expect, test } from "vitest";
import { Percent, SuspectedCategories } from "./screeningLabels";

describe("SuspectedCategories", () => {
  test("lists the categories scored at least 1%, most suspected first", () => {
    expect(SuspectedCategories({ nudity: 0.005, hate: 0.42, weapons: 0.9, gore: 0 })).toEqual([
      { category: "weapons", score: 0.9 },
      { category: "hate", score: 0.42 },
    ]);
  });

  test("nothing when nothing was measured", () => {
    expect(SuspectedCategories({})).toEqual([]);
  });
});

test("Percent rounds to whole percents", () => {
  expect(Percent(0.456)).toBe("46%");
  expect(Percent(1)).toBe("100%");
});
