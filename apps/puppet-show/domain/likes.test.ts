import { describe, expect, test } from "vitest";
import { ConfirmVote, IsVoteInFlight, SettleVotes, ShownVoteFor, StartVote } from "./likes";

describe("optimistic like", () => {
  test("a click shows the new state at once", () => {
    const pending = StartVote(undefined, false);
    expect(ShownVoteFor(4, false, pending)).toEqual({ voted: true, count: 5 });
    expect(IsVoteInFlight(pending)).toBe(true);
  });

  test("unliking lowers the count, never below zero", () => {
    expect(ShownVoteFor(3, true, StartVote(undefined, true))).toEqual({ voted: false, count: 2 });
    expect(ShownVoteFor(0, true, StartVote(undefined, true))).toEqual({ voted: false, count: 0 });
  });

  test("other people's votes from a refresh merge with the viewer's click", () => {
    const pending = StartVote(undefined, false);
    expect(ShownVoteFor(10, false, pending)).toEqual({ voted: true, count: 11 });
  });

  test("a second click before the refresh is relative to the same base", () => {
    const first = ConfirmVote(StartVote(undefined, false), true, 3);
    const second = StartVote(first, true);
    expect(second.before).toBe(false);
    expect(ShownVoteFor(4, true, second)).toEqual({ voted: false, count: 4 });
  });

  test("the server's answer wins over the click", () => {
    const confirmed = ConfirmVote(StartVote(undefined, false), false, 2);
    expect(ShownVoteFor(4, false, confirmed)).toEqual({ voted: false, count: 4 });
    expect(IsVoteInFlight(confirmed)).toBe(false);
  });

  test("no click shows the server state", () => {
    expect(ShownVoteFor(2, true, undefined)).toEqual({ voted: true, count: 2 });
    expect(IsVoteInFlight(undefined)).toBe(false);
  });
});

describe("SettleVotes", () => {
  const inFlight = StartVote(undefined, false);
  const confirmed = ConfirmVote(StartVote(undefined, false), true, 5);

  test("keeps clicks still running and those a fetch started too early may miss", () => {
    expect(SettleVotes({ a: inFlight, b: confirmed }, 4)).toEqual({ a: inFlight, b: confirmed });
  });

  test("drops clicks a fetch started after the confirmation counts", () => {
    expect(SettleVotes({ a: inFlight, b: confirmed }, 5)).toEqual({ a: inFlight });
    expect(SettleVotes({ b: confirmed }, 6)).toEqual({});
  });
});
