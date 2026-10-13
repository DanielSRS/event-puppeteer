import { describe, expect, test } from "vitest";
import { ApplyFeedView, MatchesQuery, NormalizeText, SameFilter, TagPills, type FeedCard } from "./feed";

const TECH = { id: "t1", name: "Tecnologia" };
const CULTURE = { id: "t2", name: "Cultura" };

function Card(overrides: Partial<FeedCard> & { id: string }): FeedCard {
  return {
    title: `Evento ${overrides.id}`,
    description: "Descrição",
    location: "Auditório",
    schedule: [{ date: "2026-10-10" }],
    tags: [],
    voteCount: 0,
    voted: false,
    canDelete: false,
    ...overrides,
  };
}

/** In the API's ranking order. */
const CARDS = [
  Card({ id: "a", title: "Feira de Ciências", schedule: [{ date: "2026-10-12" }, { date: "2026-10-13" }], tags: [TECH], voteCount: 1 }),
  Card({ id: "b", title: "Palestra de IA", location: "Módulo 5", schedule: [{ date: "2026-10-20", startTime: "09:00" }], voteCount: 7 }),
  Card({ id: "c", title: "Semana de Calouros", schedule: [{ date: "2026-10-09", startTime: "14:00" }], tags: [CULTURE, TECH], voteCount: 3 }),
];

const ids = (cards: FeedCard[]) => cards.map((card) => card.id);
const today = "2026-10-08";

describe("ApplyFeedView", () => {
  test("Todos keeps the API ranking", () => {
    expect(ids(ApplyFeedView(CARDS, { filter: { kind: "all" }, query: "", today }))).toEqual(["a", "b", "c"]);
  });

  test("Mais próximos sorts by next day", () => {
    expect(ids(ApplyFeedView(CARDS, { filter: { kind: "soonest" }, query: "", today }))).toEqual(["c", "a", "b"]);
  });

  test("Mais próximos uses the next upcoming day of a running multi-day event", () => {
    const running = Card({ id: "r", schedule: [{ date: "2026-10-01" }, { date: "2026-10-15" }] });
    const soon = Card({ id: "s", schedule: [{ date: "2026-10-10" }] });
    expect(ids(ApplyFeedView([running, soon], { filter: { kind: "soonest" }, query: "", today }))).toEqual(["s", "r"]);
  });

  test("Mais curtidos sorts by votes, descending", () => {
    expect(ids(ApplyFeedView(CARDS, { filter: { kind: "most-liked" }, query: "", today }))).toEqual(["b", "c", "a"]);
  });

  test("a tag pill keeps only events with that tag", () => {
    expect(ids(ApplyFeedView(CARDS, { filter: { kind: "tag", tagId: "t1" }, query: "", today }))).toEqual(["a", "c"]);
    expect(ids(ApplyFeedView(CARDS, { filter: { kind: "tag", tagId: "t2" }, query: "", today }))).toEqual(["c"]);
  });

  test("search combines with the filter", () => {
    expect(ids(ApplyFeedView(CARDS, { filter: { kind: "tag", tagId: "t1" }, query: "feira", today }))).toEqual(["a"]);
    expect(ApplyFeedView(CARDS, { filter: { kind: "tag", tagId: "t2" }, query: "feira", today })).toEqual([]);
  });
});

describe("MatchesQuery", () => {
  test("ignores accents and case, in title, description and location", () => {
    expect(MatchesQuery(CARDS[0], "CIENCIAS")).toBe(true);
    expect(MatchesQuery(CARDS[1], "modulo")).toBe(true);
    expect(MatchesQuery(Card({ id: "x", description: "Venha aprender robótica" }), "robotica")).toBe(true);
  });

  test("every word must match", () => {
    expect(MatchesQuery(CARDS[1], "palestra módulo")).toBe(true);
    expect(MatchesQuery(CARDS[1], "palestra feira")).toBe(false);
  });

  test("blank query matches", () => expect(MatchesQuery(CARDS[0], "   ")).toBe(true));
});

test("TagPills lists each tag once, by name", () => {
  expect(TagPills(CARDS)).toEqual([CULTURE, TECH]);
  expect(TagPills([])).toEqual([]);
});

test("NormalizeText", () => expect(NormalizeText("Ação É")).toBe("acao e"));

test("SameFilter", () => {
  expect(SameFilter({ kind: "tag", tagId: "1" }, { kind: "tag", tagId: "1" })).toBe(true);
  expect(SameFilter({ kind: "tag", tagId: "1" }, { kind: "tag", tagId: "2" })).toBe(false);
  expect(SameFilter({ kind: "all" }, { kind: "soonest" })).toBe(false);
});
