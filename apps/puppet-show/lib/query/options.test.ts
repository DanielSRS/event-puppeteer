import { QueryClient } from "@tanstack/react-query";
import { describe, expect, test } from "vitest";
import type { ApiError, ApiResult } from "@/lib/api/client";
import { Err, Ok } from "@/lib/result";
import { ApiQuery, Freshness, ReadAnswer, type Answer } from "./options";

const NETWORK: ApiError = { kind: "network", path: "/tags" };

/** A call that answers each time with the next of `answers`. */
function Calls(...answers: Array<ApiResult<string[]>>) {
  let next = 0;
  return async () => answers[Math.min(next++, answers.length - 1)];
}

describe("ReadAnswer", () => {
  test("a good answer is the value with no error", () => {
    expect(ReadAnswer<string>({ ok: true, value: "a" })).toEqual({ value: "a", error: null });
  });

  test("a failure shows the last good value together with the error", () => {
    expect(ReadAnswer<string>({ ok: false, error: NETWORK, last: "old" })).toEqual({ value: "old", error: NETWORK });
  });

  test("nothing is asked yet", () => {
    expect(ReadAnswer<string>(undefined)).toEqual({ value: null, error: null });
  });
});

describe("ApiQuery", () => {
  test("a failed refresh keeps the last good list and says why", async () => {
    const client = new QueryClient();
    const options = ApiQuery(["tags"], Calls(Ok(["a"]), Err(NETWORK)), Freshness.long);

    await client.fetchQuery({ ...options, staleTime: 0 });
    const refreshed = await client.fetchQuery({ ...options, staleTime: 0 });

    expect(refreshed).toEqual({ ok: false, error: NETWORK, last: ["a"] });
  });

  test("a failure with nothing cached has no last value", async () => {
    const client = new QueryClient();
    const answer = await client.fetchQuery({ ...ApiQuery(["tags"], Calls(Err(NETWORK)), Freshness.long), staleTime: 0 });

    expect(answer).toEqual({ ok: false, error: NETWORK, last: null });
  });

  test("a good answer is fresh for the given time, a failed one is stale at once", async () => {
    const client = new QueryClient();
    const good = ApiQuery(["good"], Calls(Ok(["a"])), Freshness.long);
    const bad = ApiQuery(["bad"], Calls(Err(NETWORK)), Freshness.long);

    await client.fetchQuery({ ...good, staleTime: 0 });
    await client.fetchQuery({ ...bad, staleTime: 0 });

    const goodQuery = client.getQueryCache().find<Answer<string[]>>({ queryKey: good.queryKey });
    const badQuery = client.getQueryCache().find<Answer<string[]>>({ queryKey: bad.queryKey });
    if (goodQuery === undefined || badQuery === undefined || typeof good.staleTime !== "function" || typeof bad.staleTime !== "function")
      throw new Error("the queries were not cached with a staleTime function");

    expect(good.staleTime(goodQuery)).toBe(Freshness.long);
    expect(bad.staleTime(badQuery)).toBe(0);
  });
});
