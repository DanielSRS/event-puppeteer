/**
 * Image Review page of an organization (Moderator+): its Images awaiting a
 * human decision. The API leaves out the person's own Images and those of
 * Superadmins.
 *
 * @module
 */

"use client";

import { useCallback } from "react";
import { api } from "@/lib/api/client";
import { SectionDenialFor, SelectOrgNotice, useDashboard } from "../DashboardContext";
import { AccessNotice } from "../global/AccessNotice";
import { ImageReviewQueue } from "./ImageReviewQueue";

/** The page, guarded by the section rules. */
export function DashboardImagesContainer() {
  const { user, orgId } = useDashboard();
  const denial = SectionDenialFor("images", user, orgId);
  if (denial !== null) return <AccessNotice denial={denial} />;
  if (orgId === null) return <SelectOrgNotice />;
  return <OrganizationQueue key={orgId} orgId={orgId} />;
}

/** The queue of one organization; remounted when the organization changes. */
function OrganizationQueue({ orgId }: { orgId: string }) {
  const load = useCallback(() => api.images.reviews(orgId), [orgId]);
  return <ImageReviewQueue load={load} />;
}
