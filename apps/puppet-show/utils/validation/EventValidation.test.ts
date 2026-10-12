/**
 * Rules of the event editor and the request it produces.
 *
 * @module
 */

import { describe, expect, test } from "vitest";
import {
  ErrorsOfStep, HasEventErrors, IsHttpUrl, StepOfField, ToCreateEventInput, ValidateBasics,
  ValidateCoordinates, ValidateEvent, ValidateLinks, ValidateNewTag, ValidateSchedule,
  type DayEntryForm, type EventFormData,
} from "./EventValidation";

const TODAY = "2026-10-08";

/** A schedule row with defaults for the fields a test doesn't care about. */
function Day(date: string, startTime = "", endTime = ""): DayEntryForm {
  return { key: date, date, startTime, endTime };
}

/** A complete, valid form. */
function ValidForm(): EventFormData {
  return {
    title: "Feira de Robótica",
    description: "Exposição de robôs feitos pelos estudantes.",
    location: "Pavilhão de Aulas",
    latitude: "",
    longitude: "",
    days: [Day("2026-10-10", "09:00", "17:00")],
    tags: [],
    links: [],
    banner: null,
  };
}

describe("ValidateBasics", () => {
  test("accepts a complete event", () => {
    expect(ValidateBasics(ValidForm())).toEqual({});
  });

  test("title needs 3 to 120 characters, ignoring surrounding spaces", () => {
    expect(ValidateBasics({ ...ValidForm(), title: "  ab  " }).title).toMatch(/pelo menos 3/);
    expect(ValidateBasics({ ...ValidForm(), title: "a".repeat(121) }).title).toMatch(/120/);
  });

  test("description needs 10 to 2000 characters", () => {
    expect(ValidateBasics({ ...ValidForm(), description: "curta" }).description).toMatch(/10/);
    expect(ValidateBasics({ ...ValidForm(), description: "a".repeat(2001) }).description).toMatch(/2000/);
  });

  test("location is required", () => {
    expect(ValidateBasics({ ...ValidForm(), location: " " }).location).toBeDefined();
  });
});

describe("ValidateCoordinates", () => {
  test("both empty is fine (coordinates are optional)", () => {
    expect(ValidateCoordinates({ latitude: "", longitude: "" })).toEqual({});
  });

  test("valid numbers within range", () => {
    expect(ValidateCoordinates({ latitude: "-12.2", longitude: "-38.96" })).toEqual({});
    expect(ValidateCoordinates({ latitude: "90", longitude: "-180" })).toEqual({});
  });

  test("one without the other is rejected", () => {
    expect(ValidateCoordinates({ latitude: "-12", longitude: "" }).longitude).toBeDefined();
    expect(ValidateCoordinates({ latitude: "", longitude: "-38" }).latitude).toBeDefined();
  });

  test("out of range", () => {
    expect(ValidateCoordinates({ latitude: "90.1", longitude: "0" }).latitude).toMatch(/-90 e 90/);
    expect(ValidateCoordinates({ latitude: "0", longitude: "-180.5" }).longitude).toMatch(/-180 e 180/);
  });

  test("not a number", () => {
    expect(ValidateCoordinates({ latitude: "abc", longitude: "1,5" })).toEqual({
      latitude: expect.stringMatching(/número/),
      longitude: expect.stringMatching(/número/),
    });
  });
});

describe("ValidateSchedule", () => {
  test("needs at least one day", () => {
    expect(ValidateSchedule([], TODAY)).toEqual({ days: expect.any(String) });
  });

  test("date is required and can't be in the past; today is fine", () => {
    expect(ValidateSchedule([Day("")], TODAY)["days.0.date"]).toMatch(/Escolha/);
    expect(ValidateSchedule([Day("2026-10-07")], TODAY)["days.0.date"]).toMatch(/anterior/);
    expect(ValidateSchedule([Day(TODAY)], TODAY)).toEqual({});
  });

  test("times are optional", () => {
    expect(ValidateSchedule([Day("2026-10-10")], TODAY)).toEqual({});
    expect(ValidateSchedule([Day("2026-10-10", "09:00")], TODAY)).toEqual({});
  });

  test("an end time needs a start time", () => {
    expect(ValidateSchedule([Day("2026-10-10", "", "10:00")], TODAY)["days.0.endTime"]).toMatch(/início/);
  });

  test("end can't be before start; equal is allowed", () => {
    expect(ValidateSchedule([Day("2026-10-10", "10:00", "09:59")], TODAY)["days.0.endTime"]).toMatch(/antes/);
    expect(ValidateSchedule([Day("2026-10-10", "10:00", "10:00")], TODAY)).toEqual({});
  });

  test("malformed times", () => {
    const errors = ValidateSchedule([Day("2026-10-10", "25:00", "9h")], TODAY);
    expect(errors["days.0.startTime"]).toMatch(/HH:MM/);
    expect(errors["days.0.endTime"]).toMatch(/HH:MM/);
  });

  test("the same date twice is rejected on the repeated row", () => {
    const errors = ValidateSchedule([Day("2026-10-10"), Day("2026-10-11"), Day("2026-10-10")], TODAY);
    expect(errors).toEqual({ "days.2.date": expect.stringMatching(/já está/) });
  });
});

describe("ValidateLinks", () => {
  test("label and http(s) address required", () => {
    expect(ValidateLinks([{ key: "a", labelId: "l1", url: "https://example.org" }])).toEqual({});
    expect(ValidateLinks([{ key: "a", labelId: "", url: "" }])).toEqual({
      "links.0.labelId": expect.any(String),
      "links.0.url": expect.any(String),
    });
    expect(ValidateLinks([{ key: "a", labelId: "l1", url: "ftp://example.org" }])["links.0.url"]).toMatch(/http/);
    expect(ValidateLinks([{ key: "a", labelId: "l1", url: "example.org" }])["links.0.url"]).toMatch(/http/);
  });
});

describe("ValidateNewTag", () => {
  test("needs a name of up to 40 characters", () => {
    expect(ValidateNewTag("  ").newTag).toBeDefined();
    expect(ValidateNewTag("a".repeat(41)).newTag).toMatch(/40/);
    expect(ValidateNewTag("robótica")).toEqual({});
  });
});

describe("IsHttpUrl", () => {
  test("only absolute http and https addresses", () => {
    expect(IsHttpUrl("http://a.b")).toBe(true);
    expect(IsHttpUrl("https://a.b/c?d")).toBe(true);
    expect(IsHttpUrl("mailto:a@b.c")).toBe(false);
    expect(IsHttpUrl("/relative")).toBe(false);
  });
});

describe("ValidateEvent and steps", () => {
  test("a valid form has no errors", () => {
    expect(HasEventErrors(ValidateEvent(ValidForm(), TODAY))).toBe(false);
  });

  test("collects errors of every step and splits them by step", () => {
    const errors = ValidateEvent({ ...ValidForm(), title: "", days: [], links: [{ key: "k", labelId: "", url: "x" }] }, TODAY);
    expect(Object.keys(ErrorsOfStep(errors, 0))).toEqual(["title"]);
    expect(Object.keys(ErrorsOfStep(errors, 1))).toEqual(["days"]);
    expect(Object.keys(ErrorsOfStep(errors, 2))).toEqual(["links.0.labelId", "links.0.url"]);
  });

  test("StepOfField maps every field path", () => {
    expect(StepOfField("latitude")).toBe(0);
    expect(StepOfField("days.3.endTime")).toBe(1);
    expect(StepOfField("links.0.url")).toBe(2);
    expect(StepOfField("newTag")).toBe(2);
  });
});

describe("ToCreateEventInput", () => {
  test("minimal event: optional fields left out, visible", () => {
    expect(ToCreateEventInput({ ...ValidForm(), days: [Day("2026-10-10")] })).toEqual({
      title: "Feira de Robótica",
      description: "Exposição de robôs feitos pelos estudantes.",
      location: "Pavilhão de Aulas",
      isHidden: false,
      schedule: [{ date: "2026-10-10" }],
      tags: [],
      links: [],
    });
  });

  test("full event: trimmed text, numeric coordinates, sorted days, tag kinds and links", () => {
    const input = ToCreateEventInput({
      title: "  Feira  ",
      description: " Descrição longa o bastante ",
      location: " Pavilhão ",
      latitude: "-12.2",
      longitude: "-38.96",
      days: [Day("2026-10-12", "14:00"), Day("2026-10-10", "09:00", "12:00")],
      tags: [
        { id: "t1", name: "Tecnologia", isSystemDefined: true },
        { id: "t2", name: "robotica", isSystemDefined: false },
      ],
      links: [{ key: "k", labelId: "l1", url: " https://example.org/inscricao " }],
      banner: new Blob(["picture"], { type: "image/jpeg" }),
    });

    expect(input).toEqual({
      title: "Feira",
      description: "Descrição longa o bastante",
      location: "Pavilhão",
      latitude: -12.2,
      longitude: -38.96,
      isHidden: false,
      schedule: [
        { date: "2026-10-10", startTime: "09:00", endTime: "12:00" },
        { date: "2026-10-12", startTime: "14:00" },
      ],
      tags: [{ tagId: "t1", isFreeForm: false }, { tagId: "t2", isFreeForm: true }],
      links: [{ labelId: "l1", url: "https://example.org/inscricao" }],
    });
  });
});
