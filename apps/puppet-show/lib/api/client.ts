/**
 * Typed HTTP client for the Puppeteer API.
 *
 * Requests go to `/api` on the same origin; `next.config.ts` forwards them to
 * Puppeteer, so the browser never needs CORS. The session token (if any) goes
 * along as a bearer token.
 *
 * Nothing here throws. Every call resolves to a {@link Result}: either the
 * response, already validated against its schema in `./schemas`, or an
 * {@link ApiError} saying what went wrong. Turn an error into text for the
 * person with {@link ApiErrorMessage}.
 *
 * @module
 */

import type { z } from "zod";
import { Err, Ok, type Result } from "@/lib/result";
import { GetToken } from "./session";
import {
  ApiErrorBodySchema, AuditEntrySchema, CommandSchema, DeviceLogSchema, DeviceSchema, DeviceStatusSchema,
  DeviceTelemetryResponseSchema, EventSchema, EventWithVotesSchema, FeedEventSchema, ImageDecisionSchema, ImageReviewItemSchema,
  ImageViewSchema, LinkLabelSchema, LoginResponseSchema, OrganizationSchema, RegisterResponseSchema, ReportSchema, ReportStatusSchema,
  ScreeningPolicyResponseSchema, ScreeningPolicySchema, SuccessSchema, TagSchema, UserSchema, VoteResponseSchema, VoteStatusSchema,
  type CreateCommandInput, type CreateEventInput, type OrgRole, type OrganizationInput, type ReportReason, type ScreeningPolicy,
} from "./schemas";

/** Same-origin prefix that `next.config.ts` proxies to Puppeteer. */
const API_PREFIX = "/api";

/** Why an API call failed. */
export type ApiError =
  /** The browser blocked the storage that holds the session token. */
  | { kind: "storage-unavailable" }
  /** The request never got an answer (offline, server down, DNS…). */
  | { kind: "network"; path: string }
  /**
   * The API answered with an error status; `message` is the API's own `error` text and
   * `code` its error code (sent for Image errors), when present.
   */
  | { kind: "http"; status: number; message: string | null; code: string | null; path: string }
  /** The API answered 2xx with a body that doesn't match the contract. */
  | { kind: "invalid-response"; path: string; detail: string };

/** Outcome of an API call. */
export type ApiResult<T> = Result<T, ApiError>;

/**
 * Text for the person, in Portuguese, describing an {@link ApiError}.
 * Screens that know better (e.g. login answering 401) should say something
 * more specific and use this for everything else.
 */
export function ApiErrorMessage(error: ApiError): string {
  switch (error.kind) {
    case "storage-unavailable":
      return "O navegador bloqueou o armazenamento local, onde fica a sua sessão. Permita dados de site para este endereço.";
    case "network":
      return "Não foi possível falar com o servidor. Verifique sua conexão e tente de novo.";
    case "invalid-response":
      return "O servidor respondeu em um formato inesperado. Avise o suporte.";
    case "http": {
      const coded = error.code === null ? undefined : CODE_MESSAGES[error.code];
      if (coded !== undefined) return coded;
      if (error.status === 401) return "Sua sessão expirou ou você não está conectado. Entre novamente.";
      if (error.status === 403) return "Você não tem permissão para fazer isso.";
      if (error.status === 404) return "Não encontrado. Talvez tenha sido removido.";
      if (error.status === 409) return "Já existe um registro com esses dados.";
      if (error.status === 400 || error.status === 422) return "Os dados enviados foram recusados pelo servidor. Revise o formulário.";
      if (error.status >= 500) return "O servidor encontrou um erro. Tente de novo em instantes.";
      if (error.status === 429) return "Muitas tentativas. Espere um pouco e tente de novo.";
      return `O servidor recusou o pedido (erro ${error.status}).`;
    }
  }
}

/** Text for the person for each error `code` the API sends. */
const CODE_MESSAGES: Partial<Record<string, string>> = {
  IMAGE_TOO_LARGE: "A imagem passa de 4 MB. Escolha um arquivo menor.",
  IMAGE_UNSUPPORTED_FORMAT: "Formato não aceito. Envie uma imagem JPEG, PNG ou WebP (sem animação).",
  IMAGE_UNREADABLE: "Não foi possível ler esse arquivo como imagem.",
  IMAGE_WRONG_PROPORTION: "A imagem não está na proporção exigida. Recorte-a antes de enviar.",
  IMAGE_TOO_SMALL: "A imagem é pequena demais. Escolha uma imagem maior.",
  IMAGE_DAILY_LIMIT: "Você atingiu o limite de 10 imagens por dia. Tente de novo amanhã.",
  IMAGE_STORAGE_FAILED: "Não foi possível guardar a imagem agora. Tente de novo em instantes.",
  IMAGE_ALREADY_DECIDED: "Essa imagem já foi analisada por outra pessoa.",
  IMAGE_NO_LONGER_CURRENT: "Quem enviou essa imagem já a substituiu ou removeu: ela não será exibida.",
  SCREENING_POLICY_INVALID: "Cada limite deve ficar entre 0% e 100%, e o limite de revisão não pode passar o de recusa.",
};

/** Calls `fetch`, turning a rejected promise into a value. */
async function SafeFetch(url: string, init: RequestInit): Promise<Result<Response, null>> {
  try {
    return Ok(await fetch(url, init));
  } catch {
    return Err(null);
  }
}

/** Reads a body as JSON, turning malformed JSON into a value. */
async function SafeJson(response: Response): Promise<Result<unknown, string>> {
  try {
    return Ok(await response.json());
  } catch (cause) {
    return Err(cause instanceof Error ? cause.message : String(cause));
  }
}

/** The API's `{ error, code }`, each `null` when the body is absent or has another shape. */
async function ErrorBody(response: Response): Promise<{ message: string | null; code: string | null }> {
  const body = await SafeJson(response);
  if (!body.ok) return { message: null, code: null };
  const parsed = ApiErrorBodySchema.safeParse(body.value);
  if (!parsed.success) return { message: null, code: null };
  return { message: parsed.data.error, code: parsed.data.code === undefined ? null : parsed.data.code };
}

/**
 * Sends one request and validates the answer.
 *
 * @param schema - Contract the 2xx body must match.
 * @param path - Path under the API, e.g. `/organizations/abc/feed`.
 * @param method - HTTP method.
 * @param body - Sent as multipart when it is `FormData`, as JSON otherwise (when present).
 */
async function Request<S extends z.ZodType>(
  schema: S,
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
  path: string,
  body?: unknown,
): Promise<ApiResult<z.infer<S>>> {
  const token = GetToken();
  if (!token.ok) return Err({ kind: "storage-unavailable" });

  const headers: Record<string, string> = {};
  const multipart = body instanceof FormData;
  if (body !== undefined && !multipart) headers["Content-Type"] = "application/json";
  if (token.value !== null) headers.Authorization = `Bearer ${token.value}`;

  const response = await SafeFetch(`${API_PREFIX}${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: multipart ? body : JSON.stringify(body) } : {}),
  });
  if (!response.ok) return Err({ kind: "network", path });

  if (!response.value.ok)
    return Err({ kind: "http", status: response.value.status, ...await ErrorBody(response.value), path });

  const json = await SafeJson(response.value);
  if (!json.ok) return Err({ kind: "invalid-response", path, detail: json.error });

  const parsed = schema.safeParse(json.value);
  if (!parsed.success) return Err({ kind: "invalid-response", path, detail: parsed.error.message });

  return Ok(parsed.data);
}

/** Encodes one path segment (ids come from the API or the URL). */
const seg = encodeURIComponent;

/** A picture as the multipart body Image uploads take. */
function ImageForm(picture: Blob): FormData {
  const form = new FormData();
  form.set("file", picture, "image");
  return form;
}

/** Every Puppeteer endpoint puppet-show uses, grouped by resource. */
export const api = {
  auth: {
    /** Creates a Member of `orgId`. No session: login works only after the emailed link is opened. */
    register: (body: { firstName: string; lastName: string; email: string; password: string }, orgId: string) =>
      Request(RegisterResponseSchema, "POST", `/auth/register?orgId=${seg(orgId)}`, body),

    /** 401 = wrong email/password; 403 = email not verified yet. */
    login: (body: { email: string; password: string }) => Request(LoginResponseSchema, "POST", "/auth/login", body),

    /** Always succeeds, whether or not the email exists (doesn't reveal accounts). */
    resendVerification: (email: string) => Request(SuccessSchema, "POST", "/auth/resend-verification", { email }),

    /** Emails a link to choose a new password. Always succeeds (doesn't reveal accounts). */
    requestPasswordReset: (email: string) => Request(SuccessSchema, "POST", "/auth/request-password-reset", { email }),

    /** Sets a new password with the emailed token. 400 = invalid, expired or already used link. */
    resetPassword: (token: string, password: string) =>
      Request(SuccessSchema, "POST", "/auth/reset-password", { token, password }),

    /** The logged-in user. */
    me: () => Request(UserSchema, "GET", "/auth/me"),
  },

  organizations: {
    /** Superadmin only. */
    list: () => Request(OrganizationSchema.array(), "GET", "/organizations"),
    /** Public (the TV display reads the branding). */
    get: (id: string) => Request(OrganizationSchema, "GET", `/organizations/${seg(id)}`),
    /** Superadmin only. */
    create: (body: OrganizationInput) => Request(OrganizationSchema, "POST", "/organizations", body),
    /** Admin of the organization, or Superadmin. */
    update: (id: string, body: Partial<OrganizationInput>) =>
      Request(OrganizationSchema, "PATCH", `/organizations/${seg(id)}`, body),
    /** Public feed: visible, upcoming events ranked by votes and how soon they happen. */
    feed: (orgId: string) => Request(FeedEventSchema.array(), "GET", `/organizations/${seg(orgId)}/feed`),
  },

  events: {
    /** Visible, upcoming events (no votes). */
    list: (orgId: string) => Request(EventSchema.array(), "GET", `/organizations/${seg(orgId)}/events`),
    /** The logged-in user's own events in `orgId`, including hidden and past ones. */
    mine: (orgId: string) => Request(EventSchema.array(), "GET", `/organizations/${seg(orgId)}/events/mine`),
    /**
     * One event with its vote count. Hidden events and events by shadow-banned
     * authors answer 404, except to their creator, the org's Moderators+ and Superadmins.
     */
    get: (orgId: string, eventId: string) =>
      Request(EventWithVotesSchema, "GET", `/organizations/${seg(orgId)}/events/${seg(eventId)}`),
    create: (orgId: string, body: CreateEventInput) =>
      Request(EventSchema, "POST", `/organizations/${seg(orgId)}/events`, body),
    /** Soft delete; creator or Superadmin. */
    delete: (orgId: string, eventId: string) =>
      Request(SuccessSchema, "DELETE", `/organizations/${seg(orgId)}/events/${seg(eventId)}`),
    /** Toggles the logged-in user's vote. */
    vote: (orgId: string, eventId: string) =>
      Request(VoteResponseSchema, "POST", `/organizations/${seg(orgId)}/events/${seg(eventId)}/vote`),
    voteStatus: (orgId: string, eventId: string) =>
      Request(VoteStatusSchema, "GET", `/organizations/${seg(orgId)}/events/${seg(eventId)}/vote`),
    /** Whether the logged-in user already reported the event. */
    reportStatus: (orgId: string, eventId: string) =>
      Request(ReportStatusSchema, "GET", `/organizations/${seg(orgId)}/events/${seg(eventId)}/report`),
    /** One report per user per event (a second one answers 400). */
    report: (orgId: string, eventId: string, body: { reason: ReportReason; comment?: string }) =>
      Request(ReportSchema, "POST", `/organizations/${seg(orgId)}/events/${seg(eventId)}/report`, body),
    /** Moderator+. */
    hide: (orgId: string, eventId: string) =>
      Request(EventSchema, "POST", `/organizations/${seg(orgId)}/events/${seg(eventId)}/hide`),
    /** Moderator+. */
    unhide: (orgId: string, eventId: string) =>
      Request(EventSchema, "POST", `/organizations/${seg(orgId)}/events/${seg(eventId)}/unhide`),
  },

  users: {
    /** Admin+. `search` matches the name ignoring accents and case. */
    list: (orgId: string, search?: string) =>
      Request(UserSchema.array(), "GET",
        `/organizations/${seg(orgId)}/users${search ? `?search=${encodeURIComponent(search)}` : ""}`),
    /** Admin+. */
    changeRole: (orgId: string, userId: string, role: OrgRole) =>
      Request(UserSchema, "PATCH", `/organizations/${seg(orgId)}/users/${seg(userId)}/role`, { role }),
    /**
     * Superadmin only. Makes the person a Superadmin: they leave the organization
     * and gain access to every organization and the global settings. Audited.
     */
    promoteToSuperadmin: (orgId: string, userId: string) =>
      Request(UserSchema, "PATCH", `/organizations/${seg(orgId)}/users/${seg(userId)}/role`, { role: "Superadmin" }),
    /** Admin+. Deactivates the account: it can't log in anymore and its events leave the feed. */
    remove: (orgId: string, userId: string) =>
      Request(SuccessSchema, "DELETE", `/organizations/${seg(orgId)}/users/${seg(userId)}`),
  },

  moderation: {
    /** Moderator+. */
    listReports: (orgId: string) => Request(ReportSchema.array(), "GET", `/organizations/${seg(orgId)}/reports`),
    /** Moderator+. */
    listShadowBans: (orgId: string) => Request(UserSchema.array(), "GET", `/organizations/${seg(orgId)}/shadow-bans`),
    /** Moderator+. */
    liftShadowBan: (orgId: string, userId: string) =>
      Request(UserSchema, "DELETE", `/organizations/${seg(orgId)}/shadow-bans/${seg(userId)}`),
    /** Admin+. */
    listAudit: (orgId: string) => Request(AuditEntrySchema.array(), "GET", `/organizations/${seg(orgId)}/audit`),
  },

  images: {
    /**
     * Event creator only. A cropped 16:9 picture of at least 960×540. Answers the banner
     * as its uploader sees it (always as published).
     */
    uploadBanner: (orgId: string, eventId: string, picture: Blob) =>
      Request(ImageViewSchema, "PUT", `/organizations/${seg(orgId)}/events/${seg(eventId)}/banner`, ImageForm(picture)),
    /** Event creator only. */
    removeBanner: (orgId: string, eventId: string) =>
      Request(SuccessSchema, "DELETE", `/organizations/${seg(orgId)}/events/${seg(eventId)}/banner`),
    /** Admin+. A cropped square picture of at least 256×256. */
    uploadLogo: (orgId: string, picture: Blob) =>
      Request(ImageViewSchema, "PUT", `/organizations/${seg(orgId)}/logo`, ImageForm(picture)),
    /** Admin+. */
    removeLogo: (orgId: string) => Request(SuccessSchema, "DELETE", `/organizations/${seg(orgId)}/logo`),
    /** Moderator+: the organization's Images awaiting Image Review (never the caller's own). */
    reviews: (orgId: string) =>
      Request(ImageReviewItemSchema.array(), "GET", `/organizations/${seg(orgId)}/image-reviews`),
    /** Superadmin: Images only Superadmins can review. */
    escalated: () => Request(ImageReviewItemSchema.array(), "GET", "/image-reviews/escalated"),
    /** 409 when someone else already decided it. */
    approve: (imageId: string) => Request(ImageDecisionSchema, "POST", `/image-reviews/${seg(imageId)}/approve`),
    /** A Confirmed Rejection: the uploader is shadow-banned. 409 when someone else already decided it. */
    reject: (imageId: string) => Request(ImageDecisionSchema, "POST", `/image-reviews/${seg(imageId)}/reject`),
  },

  screeningPolicy: {
    /** Superadmin only. `{ policy: null }` until first set. */
    get: () => Request(ScreeningPolicyResponseSchema, "GET", "/screening-policy"),
    /** Superadmin only. Audited. */
    set: (policy: ScreeningPolicy) => Request(ScreeningPolicySchema, "PUT", "/screening-policy", policy),
  },

  tags: {
    /** Public. */
    list: () => Request(TagSchema.array(), "GET", "/tags"),
    /** Any user may suggest a free-form tag; only a Superadmin creates system-defined ones. 409 = name taken. */
    create: (name: string, isSystemDefined: boolean) => Request(TagSchema, "POST", "/tags", { name, isSystemDefined }),
    /** Moderator+: makes a free-form tag public. */
    promote: (tagId: string) => Request(TagSchema, "POST", `/tags/${seg(tagId)}/promote`),
  },

  linkLabels: {
    /** Public. */
    list: () => Request(LinkLabelSchema.array(), "GET", "/link-labels"),
    /** Superadmin only. 409 = name taken. */
    create: (name: string) => Request(LinkLabelSchema, "POST", "/link-labels", { name }),
  },

  devices: {
    /** Superadmin: devices that connected without naming an organization. */
    listPending: () => Request(DeviceSchema.array(), "GET", "/devices/pending"),
    /** Admin of the device's organization, or Superadmin (who must pass `organizationId` for orphans). */
    approve: (deviceId: string, body: { name: string; location: string; organizationId?: string }) =>
      Request(DeviceSchema, "POST", `/devices/${seg(deviceId)}/approve`, body),
    reject: (deviceId: string) => Request(DeviceSchema, "POST", `/devices/${seg(deviceId)}/reject`),

    listActive: (orgId: string) => Request(DeviceSchema.array(), "GET", `/organizations/${seg(orgId)}/devices`),
    listOrgPending: (orgId: string) =>
      Request(DeviceSchema.array(), "GET", `/organizations/${seg(orgId)}/devices/pending`),
    get: (orgId: string, deviceId: string) =>
      Request(DeviceSchema, "GET", `/organizations/${seg(orgId)}/devices/${seg(deviceId)}`),
    status: (orgId: string, deviceId: string) =>
      Request(DeviceStatusSchema, "GET", `/organizations/${seg(orgId)}/devices/${seg(deviceId)}/status`),
    /** `{ telemetry: null }` until the device sends telemetry for the first time. */
    telemetry: (orgId: string, deviceId: string) =>
      Request(DeviceTelemetryResponseSchema, "GET", `/organizations/${seg(orgId)}/devices/${seg(deviceId)}/telemetry`),
    logs: (orgId: string, deviceId: string) =>
      Request(DeviceLogSchema.array(), "GET", `/organizations/${seg(orgId)}/devices/${seg(deviceId)}/logs`),
    commands: (orgId: string, deviceId: string) =>
      Request(CommandSchema.array(), "GET", `/organizations/${seg(orgId)}/devices/${seg(deviceId)}/commands`),
    sendCommand: (orgId: string, deviceId: string, body: CreateCommandInput) =>
      Request(CommandSchema, "POST", `/organizations/${seg(orgId)}/devices/${seg(deviceId)}/commands`, body),
  },
};
