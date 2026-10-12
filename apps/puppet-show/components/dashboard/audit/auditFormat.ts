/**
 * Turns raw audit entries into sentences a person can read: the action in
 * Portuguese, who did it (or that it was automatic), what it was done to and
 * the details, without any raw `key: value` text.
 *
 * Names come from lookups the container fills from the API (users, events,
 * tags). A lookup that failed stays a failure (`Err`) so the screen can show
 * it as such instead of an id that looks like data.
 *
 * @module
 */

import type { AuditAction, AuditEntry } from "@/lib/api/schemas";
import { Err, Ok, type Result } from "@/lib/result";
import { RoleLabel } from "../roleLabels";

/** Portuguese label of each audit action. */
export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  hide_event: "Evento ocultado",
  unhide_event: "Evento reexibido",
  apply_shadow_ban: "Shadow ban aplicado",
  lift_shadow_ban: "Shadow ban removido",
  promote_tag: "Tag promovida",
  update_org_threshold: "Limite de denúncias alterado",
  remove_user: "Usuário removido",
  change_role: "Papel alterado",
  approve_image: "Imagem aprovada na revisão",
  reject_image: "Imagem rejeitada na revisão",
  update_screening_policy: "Política de triagem alterada",
};

/** How actions without an actor (the automatic report threshold) are attributed. */
export const AUTOMATIC_ACTOR_LABEL = "Automático (limite de denúncias)";

/** A name found by a lookup, or why it couldn't be found. */
export type Lookup = Result<string, string>;

/** Name lookups filled by the container from the API. */
export type AuditLookups = {
  /** `"Ana Admin (admin@x.org)"` for a user id. */
  user: (id: string) => Lookup;
  /** Event title for an event id. */
  event: (id: string) => Lookup;
  /** Tag name for a tag id. */
  tag: (id: string) => Lookup;
};

/** Who performed an action. */
export type AuditActor = { kind: "automatic" } | { kind: "user"; name: Lookup };

/** An audit entry ready to be shown. */
export type AuditRow = {
  id: string;
  action: AuditAction;
  actionLabel: string;
  createdAt: string;
  actor: AuditActor;
  /** What the action was done to. */
  target: Lookup;
  /** One sentence per detail; failures are lookups that didn't work. */
  details: Lookup[];
};

/** Portuguese text of the `reason` detail. */
const REASONS: Record<string, string> = {
  auto_threshold_reached: "o evento atingiu o limite de denúncias da organização",
  confirmed_image_rejection: "uma imagem enviada pela pessoa foi rejeitada na revisão de imagens",
};

/** `1 evento` / `3 eventos`. */
function Plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** Renders a value of an unknown detail without exposing JSON syntax for plain values. */
function PlainValue(value: unknown): string {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

/** Prefixes a successful lookup, keeping failures as they are. */
function Prefixed(prefix: string, lookup: Lookup): Lookup {
  return lookup.ok ? Ok(`${prefix}${lookup.value}`) : Err(`${prefix}${lookup.error}`);
}

/** One sentence for one detail of an entry. */
function DetailSentence(key: string, value: unknown, lookups: AuditLookups): Lookup {
  if (key === "reason" && typeof value === "string") {
    const reason = REASONS[value];
    return Ok(`Motivo: ${reason === undefined ? value : reason}.`);
  }
  if (key === "eventId" && typeof value === "string")
    return Prefixed("Evento que motivou: ", lookups.event(value));
  if (key === "shadowBanThreshold" && typeof value === "number")
    return Ok(`Novo limite: ${Plural(value, "denúncia", "denúncias")} para ocultar um evento.`);
  if (key === "from" || key === "to") {
    const role = RoleLabel(value);
    if (role !== null) return Ok(`${key === "from" ? "Papel anterior" : "Novo papel"}: ${role}.`);
  }
  if (key === "imageId" && typeof value === "string")
    return Ok("A imagem rejeitada fica guardada para a moderação e nunca é exibida.");
  if (key === "deletedEvents" && typeof value === "number")
    return Ok(`${Plural(value, "evento excluído", "eventos excluídos")} junto com a conta.`);
  return Ok(`Informação adicional “${key}”: ${PlainValue(value)}.`);
}

/** The details of an entry as sentences, in the order the API sent them. */
export function FormatAuditDetails(details: AuditEntry["details"], lookups: AuditLookups): Lookup[] {
  if (details === undefined) return [];
  return Object.entries(details).map(([key, value]) => DetailSentence(key, value, lookups));
}

/** What an entry was done to. */
export function DescribeTarget(entry: Pick<AuditEntry, "targetType" | "targetId">, lookups: AuditLookups): Lookup {
  switch (entry.targetType) {
    case "event": return Prefixed("Evento ", lookups.event(entry.targetId));
    case "user": return Prefixed("Usuário ", lookups.user(entry.targetId));
    case "tag": return Prefixed("Tag ", lookups.tag(entry.targetId));
    case "organization": return Ok("Esta organização");
    case "image": return Ok("Uma imagem enviada (banner ou logo)");
    case "screening_policy": return Ok("A política de triagem de imagens");
    default: return Err(`Tipo de alvo desconhecido “${entry.targetType}” (${entry.targetId})`);
  }
}

/** Builds the row shown for one entry. */
export function ToAuditRow(entry: AuditEntry, lookups: AuditLookups): AuditRow {
  return {
    id: entry.id,
    action: entry.action,
    actionLabel: AUDIT_ACTION_LABELS[entry.action],
    createdAt: entry.createdAt,
    actor: entry.actorId === undefined ? { kind: "automatic" } : { kind: "user", name: lookups.user(entry.actorId) },
    target: DescribeTarget(entry, lookups),
    details: FormatAuditDetails(entry.details, lookups),
  };
}

/** Newest first. */
export function NewestFirst(entries: readonly AuditEntry[]): AuditEntry[] {
  return [...entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
