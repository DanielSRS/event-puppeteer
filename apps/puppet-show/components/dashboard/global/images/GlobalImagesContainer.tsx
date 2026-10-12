/**
 * Escalated Image Review page (Superadmin, global context): Images only
 * Superadmins can decide, those sent by Superadmins and those of
 * organizations with no other Moderator or Admin to review them. Each shows
 * the organization it comes from.
 *
 * @module
 */

"use client";

import { useEffect, useState } from "react";
import { api, ApiErrorMessage } from "@/lib/api/client";
import { ErrorAlert, LoadingMessage } from "@/components/ui/Feedback";
import { SectionDenialFor, useDashboard } from "../../DashboardContext";
import { AccessNotice } from "../AccessNotice";
import { ImageReviewQueue } from "../../images/ImageReviewQueue";

/** Loads the escalated queue. */
const LoadEscalated = () => api.images.escalated();

/** The page, guarded by the section rules. */
export function GlobalImagesContainer() {
  const { user, orgId } = useDashboard();
  const denial = SectionDenialFor("global-images", user, orgId);
  if (denial !== null) return <AccessNotice denial={denial} />;
  return <EscalatedQueue />;
}

/** The escalated queue, with organization names. */
function EscalatedQueue() {
  const [names, setNames] = useState<{ ok: true; value: ReadonlyMap<string, string> } | { ok: false; error: string } | null>(null);

  useEffect(() => {
    let active = true;
    api.organizations.list().then((orgs) => {
      if (!active) return;
      setNames(orgs.ok
        ? { ok: true, value: new Map(orgs.value.map((org) => [org.id, org.name])) }
        : { ok: false, error: `Não foi possível carregar as organizações. ${ApiErrorMessage(orgs.error)}` });
    });
    return () => { active = false; };
  }, []);

  if (names === null) return <LoadingMessage>Carregando organizações...</LoadingMessage>;
  if (!names.ok) return <ErrorAlert>{names.error}</ErrorAlert>;
  return <ImageReviewQueue load={LoadEscalated} organizationNames={names.value} />;
}
