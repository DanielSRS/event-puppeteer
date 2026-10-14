/**
 * Escalated Image Review page (Superadmin, global context): Images only
 * Superadmins can decide, those sent by Superadmins and those of
 * organizations with no other Moderator or Admin to review them. Each shows
 * the organization it comes from. The page header is drawn here, in every
 * state; the queue itself is the shared Image Review list.
 *
 * @module
 */

"use client";

import { useMemo } from "react";
import { api, ApiErrorMessage } from "@/lib/api/client";
import { organizationsQuery } from "@/lib/query/queries";
import { useApiQuery } from "@/lib/query/useApiQuery";
import { ErrorAlert, LoadingMessage } from "@/components/ui/Feedback";
import { SectionDenialFor, useDashboard } from "../../DashboardContext";
import { AccessNotice } from "../AccessNotice";
import { ImageReviewQueue, imageReviewQuery } from "../../images/ImageReviewQueue";
import { GlobalPage } from "../global-page";

/** Loads the escalated queue. */
const LoadEscalated = () => api.images.escalated();

/** Where the escalated queue is cached. */
const ESCALATED_KEY = ["dashboard", "global-images"] as const;

/** The Images only Superadmins can review. */
export const escalatedImagesQuery = () => imageReviewQuery(ESCALATED_KEY, LoadEscalated);

/** The page, guarded by the section rules. */
export function GlobalImagesContainer() {
  const { user, orgId } = useDashboard();
  const denial = SectionDenialFor("global-images", user, orgId);
  return (
    <GlobalPage
      title="Imagens Escalonadas"
      description="Imagens que só um Superadmin pode decidir: enviadas por Superadmins ou de organizações sem outra pessoa para revisar."
    >
      {denial !== null ? <AccessNotice denial={denial} /> : <EscalatedQueue />}
    </GlobalPage>
  );
}

/** The escalated queue, with organization names. */
function EscalatedQueue() {
  const orgs = useApiQuery(organizationsQuery());
  const names = useMemo<ReadonlyMap<string, string> | null>(
    () => (orgs.value === null ? null : new Map(orgs.value.map((org) => [org.id, org.name]))),
    [orgs.value],
  );

  if (names === null) {
    return orgs.error === null
      ? <LoadingMessage>Carregando organizações...</LoadingMessage>
      : <ErrorAlert>{`Não foi possível carregar as organizações. ${ApiErrorMessage(orgs.error)}`}</ErrorAlert>;
  }
  return <ImageReviewQueue cacheKey={ESCALATED_KEY} load={LoadEscalated} organizationNames={names} />;
}
