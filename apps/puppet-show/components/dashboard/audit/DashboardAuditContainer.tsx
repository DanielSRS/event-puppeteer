/**
 * Audit trail page (Admin+): loads the entries and everything needed to name
 * their actors and targets (organization users, the events and tags they
 * mention), then shows them as sentences.
 *
 * A lookup that fails is shown as a failure on the entry it affects, and a
 * list that couldn't be loaded at all is also reported above the table.
 *
 * @module
 */

"use client";

import { api, ApiErrorMessage } from "@/lib/api/client";
import type { AuditEntry, User } from "@/lib/api/schemas";
import { Err, Ok, type Result } from "@/lib/result";
import { Freshness } from "@/lib/query/options";
import { LoadedQuery } from "@/lib/query/loaded";
import { useLoaded } from "@/lib/query/useLoaded";
import { ErrorAlert, LoadingMessage } from "@/components/ui/Feedback";
import { SectionDenialFor, SelectOrgNotice, useDashboard } from "../DashboardContext";
import { AccessNotice } from "../global/AccessNotice";
import { NewestFirst, ToAuditRow, type AuditLookups, type AuditRow, type Lookup } from "./auditFormat";
import { AuditList } from "./AuditList";

/** What the page shows once loaded. */
type AuditPage = { rows: AuditRow[]; problems: string[] };

/** `"Ana Admin (admin@x.org)"`. */
export function PersonName(user: User): string {
  return `${user.firstName} ${user.lastName} (${user.email})`;
}

/** Event ids an entry mentions, as target or in its details. */
function MentionedEvents(entry: AuditEntry): string[] {
  const ids: string[] = [];
  if (entry.targetType === "event") ids.push(entry.targetId);
  const fromDetails = entry.details === undefined ? undefined : entry.details.eventId;
  if (typeof fromDetails === "string") ids.push(fromDetails);
  return ids;
}

/** Builds a lookup from a map of loaded names, or from the error that prevented loading them. */
function MapLookup(names: Result<Map<string, string>, string>, missing: (id: string) => string): (id: string) => Lookup {
  return (id) => {
    if (!names.ok) return Err(`não identificado (${names.error})`);
    const name = names.value.get(id);
    return name === undefined ? Err(missing(id)) : Ok(name);
  };
}

/**
 * Loads the trail of `orgId` and resolves its names. The logged-in person is
 * named too (a Superadmin isn't in the organization's user list).
 */
async function LoadAudit(orgId: string, meId: string, meName: string): Promise<Result<AuditPage, string>> {
  const entries = await api.moderation.listAudit(orgId);
  if (!entries.ok) return Err(`Não foi possível carregar a auditoria. ${ApiErrorMessage(entries.error)}`);

  const eventIds = [...new Set(entries.value.flatMap(MentionedEvents))];
  const [users, tags, events] = await Promise.all([
    api.users.list(orgId),
    api.tags.list(),
    Promise.all(eventIds.map((id) => api.events.get(orgId, id))),
  ]);

  const problems: string[] = [];

  const userNames = new Map<string, string>([[meId, meName]]);
  if (users.ok) for (const user of users.value) userNames.set(user.id, PersonName(user));
  else problems.push(`Não foi possível carregar as pessoas da organização, então os nomes não aparecem. ${ApiErrorMessage(users.error)}`);

  if (!tags.ok) problems.push(`Não foi possível carregar as tags, então os nomes das tags não aparecem. ${ApiErrorMessage(tags.error)}`);

  const eventTitles = new Map<string, Lookup>();
  eventIds.forEach((id, index) => {
    const event = events[index];
    eventTitles.set(id, event.ok
      ? Ok(`“${event.value.title}”`)
      : Err(`não carregado (${ApiErrorMessage(event.error)})`));
  });

  const lookups: AuditLookups = {
    user: MapLookup(
      users.ok ? Ok(userNames) : Err(ApiErrorMessage(users.error)),
      () => "não encontrado entre as pessoas ativas da organização (conta removida ou de um Superadmin)",
    ),
    tag: MapLookup(
      tags.ok ? Ok(new Map(tags.value.map((tag) => [tag.id, `“${tag.name}”`]))) : Err(ApiErrorMessage(tags.error)),
      () => "não encontrada na lista de tags",
    ),
    event: (id) => {
      const title = eventTitles.get(id);
      return title === undefined ? Err("não carregado") : title;
    },
  };

  return Ok({ rows: NewestFirst(entries.value).map((entry) => ToAuditRow(entry, lookups)), problems });
}

/** The audit trail of `orgId`, as `meId` (named `meName`) sees it. */
export const auditQuery = (orgId: string, meId: string, meName: string) =>
  LoadedQuery(["dashboard", "audit", orgId, meId], () => LoadAudit(orgId, meId, meName), Freshness.short);

/** The page, guarded by the section rules. */
export function DashboardAuditContainer() {
  const { user, orgId } = useDashboard();
  const denial = SectionDenialFor("audit", user, orgId);
  if (denial !== null) return <AccessNotice denial={denial} />;
  if (orgId === null) return <SelectOrgNotice />;
  return <AuditTrail key={orgId} orgId={orgId} meId={user.id} meName={PersonName(user)} />;
}

/** The trail of one organization; remounted when the organization changes. */
function AuditTrail({ orgId, meId, meName }: { orgId: string; meId: string; meName: string }) {
  const page = useLoaded(auditQuery(orgId, meId, meName)).result;

  if (page === null) return <LoadingMessage>Carregando auditoria...</LoadingMessage>;
  if (!page.ok) return <ErrorAlert>{page.error}</ErrorAlert>;

  return (
    <div className="column gap-4">
      {page.value.problems.map((problem) => <ErrorAlert key={problem}>{problem}</ErrorAlert>)}
      <AuditList rows={page.value.rows} />
    </div>
  );
}
