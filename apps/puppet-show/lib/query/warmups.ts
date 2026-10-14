/**
 * What the screens outside the dashboard read, as warm-ups (see `./warm`).
 *
 * @module
 */

import { eventQuery, linkLabelsQuery, organizationQuery, reportStatusQuery, tagsQuery, voteStatusQuery } from "./queries";
import { WarmApi, type Warmup } from "./warm";

/** What the event details page reads; the viewer's own vote and report only when they are logged in. */
export function EventPageWarmups(orgId: string, eventId: string, loggedIn: boolean): Warmup[] {
  const warmups = [
    WarmApi(eventQuery(orgId, eventId)),
    WarmApi(tagsQuery()),
    WarmApi(linkLabelsQuery()),
    WarmApi(organizationQuery(orgId)),
  ];
  if (loggedIn) warmups.push(WarmApi(voteStatusQuery(orgId, eventId)), WarmApi(reportStatusQuery(orgId, eventId)));
  return warmups;
}

/** What the "Publicar" page reads: the catalogs its form offers. */
export function PublishPageWarmups(): Warmup[] {
  return [WarmApi(tagsQuery()), WarmApi(linkLabelsQuery())];
}
