/**
 * What each dashboard section needs from the API, so the data can be fetched
 * when the person shows intent to open it (hovering or focusing its link)
 * instead of after the page opens.
 *
 * Each entry names the same query the section's page reads (they are exported
 * by the page's container), so the page finds its data in the cache.
 *
 * @module
 */

import type { User } from "@/lib/api/schemas";
import { UserOrgId } from "@/lib/api/schemas";
import { organizationQuery, organizationsQuery } from "@/lib/query/queries";
import { WarmApi, WarmLoaded, type Warmup } from "@/lib/query/warm";
import { auditQuery, PersonName } from "./audit/DashboardAuditContainer";
import { bansQuery } from "./bans/DashboardBansContainer";
import { devicesQuery } from "./devices/DashboardDevicesContainer";
import type { DashboardSection } from "./DashboardSections";
import { ownEventListQuery } from "./events/DashboardEventsContainer";
import { organizationImagesQuery } from "./images/DashboardImagesContainer";
import { escalatedImagesQuery } from "./global/images/GlobalImagesContainer";
import { orphansQuery } from "./global/devices/GlobalDevicesContainer";
import { globalLabelsQuery } from "./global/links/GlobalLinksContainer";
import { organizationListQuery } from "./global/orgs/GlobalOrgsContainer";
import { screeningPolicyQuery } from "./global/screening/GlobalScreeningContainer";
import { globalTagsQuery } from "./global/tags/GlobalTagsContainer";
import { reportQueueQuery } from "./reports/DashboardReportsContainer";
import { settingsQuery } from "./settings/DashboardSettingsContainer";
import { tagReviewQuery } from "./tags/DashboardTagsContainer";
import { usersQuery } from "./users/DashboardUsersContainer";

/**
 * What the dashboard shell needs to open: the organization the person manages,
 * or every organization for a Superadmin.
 */
export function ShellWarmups(user: User): Warmup[] {
  const own = UserOrgId(user);
  return own === null ? [WarmApi(organizationsQuery())] : [WarmApi(organizationQuery(own))];
}

/**
 * What opening `/dashboard` reads: the shell and, for someone who manages
 * their own organization, the first section it opens ("Meus Eventos").
 */
export function DashboardEntryWarmups(user: User): Warmup[] {
  const own = UserOrgId(user);
  return own === null ? ShellWarmups(user) : [...ShellWarmups(user), ...SectionWarmups("events", user, own)];
}

/**
 * What `section` reads, for the person `user` managing `orgId` (`null` = the
 * Superadmin's global context). Nothing for a section that needs an
 * organization when none is selected.
 */
export function SectionWarmups(section: DashboardSection, user: User, orgId: string | null): Warmup[] {
  switch (section) {
    case "global-orgs": return [WarmLoaded(organizationListQuery())];
    case "global-devices": return [WarmLoaded(orphansQuery())];
    case "global-tags": return [WarmLoaded(globalTagsQuery())];
    case "global-links": return [WarmLoaded(globalLabelsQuery())];
    case "global-screening": return [WarmLoaded(screeningPolicyQuery())];
    case "global-images": return [WarmApi(organizationsQuery()), WarmLoaded(escalatedImagesQuery())];
    case "tags": return [WarmLoaded(tagReviewQuery())];
  }

  if (orgId === null) return [];
  switch (section) {
    case "events": return [WarmLoaded(ownEventListQuery(orgId))];
    case "reports": return [WarmLoaded(reportQueueQuery(orgId))];
    case "images": return [WarmLoaded(organizationImagesQuery(orgId))];
    case "bans": return [WarmLoaded(bansQuery(orgId))];
    case "audit": return [WarmLoaded(auditQuery(orgId, user.id, PersonName(user)))];
    case "users": return [WarmLoaded(usersQuery(orgId, ""))];
    case "devices": return [WarmLoaded(devicesQuery(orgId))];
    case "settings": return [WarmLoaded(settingsQuery(orgId))];
    default: return [];
  }
}
