/**
 * The event editor's data, its rules and how it becomes an API request.
 *
 * Everything here is pure: the editor validates with {@link ValidateEvent} and
 * builds the request body with {@link ToCreateEventInput}. Rules follow the spec
 * and the API (an end time needs a start time; dates can't be in the past).
 *
 * Errors are keyed by field path so each message can sit next to its control:
 * `title`, `description`, `location`, `latitude`, `longitude`,
 * `days` (the schedule as a whole), `days.<i>.date|startTime|endTime`,
 * `links.<i>.labelId|url`, and `newTag` (the free-form tag field).
 *
 * @module
 */

import type { CreateEventInput, Tag } from "@/lib/api/schemas";

/** One day of the schedule as typed in the form. Empty strings mean "not filled". */
export type DayEntryForm = {
  /** Stable key for the list row; not sent to the API. */
  key: string;
  /** `YYYY-MM-DD`. */
  date: string;
  /** `HH:MM`, or empty for an all-day entry. */
  startTime: string;
  /** `HH:MM`, or empty. Requires `startTime`. */
  endTime: string;
};

/** One external link as typed in the form. */
export type EventLinkForm = {
  /** Stable key for the list row; not sent to the API. */
  key: string;
  /** Id of a link label from `GET /link-labels`; empty until one is picked. */
  labelId: string;
  url: string;
};

/** Everything the event editor collects. */
export type EventFormData = {
  title: string;
  description: string;
  location: string;
  /** Decimal degrees as typed; empty when the event has no coordinates. */
  latitude: string;
  /** Decimal degrees as typed; empty when the event has no coordinates. */
  longitude: string;
  days: DayEntryForm[];
  /** Tags picked for the event (system-defined or free-form). */
  tags: Tag[];
  links: EventLinkForm[];
  /**
   * The banner, already cropped to 16:9; `null` for none. Uploaded once the event
   * exists, so it is not part of the request body.
   */
  banner: Blob | null;
};

/** Error messages by field path (see the module docs). A missing key means the field is fine. */
export type EventFormErrors = Record<string, string>;

/** The three steps of the editor, in order. */
export const EVENT_FORM_STEPS = ["Informações", "Data e horário", "Mídia e links"] as const;

/** Index of the editor step that shows the field at `path`. */
export function StepOfField(path: string): number {
  if (path === "days" || path.startsWith("days.")) return 1;
  if (path === "newTag" || path.startsWith("links.")) return 2;
  return 0;
}

/** Signed decimal number, as an `<input type="number">` produces it. */
const DECIMAL = /^-?\d+(\.\d+)?$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Whether `value` is an absolute `http:` or `https:` address. */
export function IsHttpUrl(value: string): boolean {
  if (!URL.canParse(value)) return false;
  const { protocol } = new URL(value);
  return protocol === "http:" || protocol === "https:";
}

/** Checks title, description and location. */
export function ValidateBasics(data: Pick<EventFormData, "title" | "description" | "location">): EventFormErrors {
  const errors: EventFormErrors = {};
  const title = data.title.trim();
  const description = data.description.trim();
  const location = data.location.trim();

  if (title.length < 3) errors.title = "Informe um nome com pelo menos 3 letras.";
  else if (title.length > 120) errors.title = "O nome pode ter no máximo 120 caracteres.";

  if (description.length < 10) errors.description = "Conte um pouco mais sobre o evento (pelo menos 10 caracteres).";
  else if (description.length > 2000) errors.description = "A descrição pode ter no máximo 2000 caracteres.";

  if (location.length < 3) errors.location = "Informe onde o evento acontece.";

  return errors;
}

/** Checks one coordinate typed as text against its range. */
function CoordinateError(value: string, min: number, max: number, name: string): string | null {
  if (!DECIMAL.test(value)) return `A ${name} deve ser um número (use ponto para decimais).`;
  const number = Number(value);
  if (number < min || number > max) return `A ${name} deve estar entre ${min} e ${max}.`;
  return null;
}

/**
 * Checks the optional coordinates: both empty, or both valid numbers with
 * latitude in −90..90 and longitude in −180..180.
 */
export function ValidateCoordinates(data: Pick<EventFormData, "latitude" | "longitude">): EventFormErrors {
  const errors: EventFormErrors = {};
  const latitude = data.latitude.trim();
  const longitude = data.longitude.trim();

  if (latitude === "" && longitude === "") return errors;

  if (latitude === "") errors.latitude = "Informe a latitude também, ou apague a longitude.";
  else {
    const error = CoordinateError(latitude, -90, 90, "latitude");
    if (error !== null) errors.latitude = error;
  }

  if (longitude === "") errors.longitude = "Informe a longitude também, ou apague a latitude.";
  else {
    const error = CoordinateError(longitude, -180, 180, "longitude");
    if (error !== null) errors.longitude = error;
  }

  return errors;
}

/**
 * Checks the schedule: at least one day; each with a valid date not before
 * `today`; times as `HH:MM`; an end time needs a start time and can't be
 * earlier than it; the same date can't appear twice.
 *
 * @param today - Today as `YYYY-MM-DD` (in Brazil), passed in to keep this pure.
 */
export function ValidateSchedule(days: DayEntryForm[], today: string): EventFormErrors {
  const errors: EventFormErrors = {};

  if (days.length === 0) {
    errors.days = "Adicione pelo menos um dia.";
    return errors;
  }

  const seen = new Set<string>();

  days.forEach((day, index) => {
    const at = `days.${index}`;

    if (!DATE.test(day.date)) errors[`${at}.date`] = "Escolha a data.";
    else if (day.date < today) errors[`${at}.date`] = "A data não pode ser anterior a hoje.";
    else if (seen.has(day.date)) errors[`${at}.date`] = "Esta data já está na programação.";
    seen.add(day.date);

    const hasStart = day.startTime !== "";
    const hasEnd = day.endTime !== "";

    if (hasStart && !TIME.test(day.startTime)) errors[`${at}.startTime`] = "Use o formato HH:MM.";

    if (hasEnd && !TIME.test(day.endTime)) errors[`${at}.endTime`] = "Use o formato HH:MM.";
    else if (hasEnd && !hasStart) errors[`${at}.endTime`] = "Para informar o término, informe também o início.";
    else if (hasEnd && TIME.test(day.startTime) && day.endTime < day.startTime)
      errors[`${at}.endTime`] = "O término não pode ser antes do início.";
  });

  return errors;
}

/** Checks each link: a label picked and an `http(s)` address. */
export function ValidateLinks(links: EventLinkForm[]): EventFormErrors {
  const errors: EventFormErrors = {};

  links.forEach((link, index) => {
    if (link.labelId === "") errors[`links.${index}.labelId`] = "Escolha o tipo do link.";

    const url = link.url.trim();
    if (url === "") errors[`links.${index}.url`] = "Informe o endereço do link.";
    else if (!IsHttpUrl(url)) errors[`links.${index}.url`] = "O endereço deve começar com http:// ou https://.";
  });

  return errors;
}

/** Checks a free-form tag name before it is created. */
export function ValidateNewTag(name: string): EventFormErrors {
  const trimmed = name.trim();
  if (trimmed === "") return { newTag: "Digite o nome da tag." };
  if (trimmed.length > 40) return { newTag: "A tag pode ter no máximo 40 caracteres." };
  return {};
}

/**
 * Every rule of the editor. Empty result = the event can be sent.
 *
 * @param today - Today as `YYYY-MM-DD` (in Brazil).
 */
export function ValidateEvent(data: EventFormData, today: string): EventFormErrors {
  return {
    ...ValidateBasics(data),
    ...ValidateCoordinates(data),
    ...ValidateSchedule(data.days, today),
    ...ValidateLinks(data.links),
  };
}

/** Errors that belong to one step of the editor. */
export function ErrorsOfStep(errors: EventFormErrors, step: number): EventFormErrors {
  return Object.fromEntries(Object.entries(errors).filter(([path]) => StepOfField(path) === step));
}

/** Whether there is any error. */
export function HasEventErrors(errors: EventFormErrors): boolean {
  return Object.keys(errors).length > 0;
}

/**
 * Builds the body of `POST /organizations/:id/events` from a form that passed
 * {@link ValidateEvent}. Text is trimmed, empty optional fields are left out,
 * days are sent in date order and the event starts visible.
 */
export function ToCreateEventInput(data: EventFormData): CreateEventInput {
  const latitude = data.latitude.trim();
  const longitude = data.longitude.trim();

  return {
    title: data.title.trim(),
    description: data.description.trim(),
    location: data.location.trim(),
    ...(latitude !== "" && longitude !== "" ? { latitude: Number(latitude), longitude: Number(longitude) } : {}),
    isHidden: false,
    schedule: [...data.days]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((day) => ({
        date: day.date,
        ...(day.startTime !== "" ? { startTime: day.startTime } : {}),
        ...(day.endTime !== "" ? { endTime: day.endTime } : {}),
      })),
    tags: data.tags.map((tag) => ({ tagId: tag.id, isFreeForm: !tag.isSystemDefined })),
    links: data.links.map((link) => ({ labelId: link.labelId, url: link.url.trim() })),
  };
}
