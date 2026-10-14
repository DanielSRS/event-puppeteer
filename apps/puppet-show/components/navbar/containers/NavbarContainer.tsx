/**
 * Connects the top bar to the session and the organization's branding
 * (name, logo and the color the whole palette is generated from).
 *
 * @module
 */

"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { FeedOrgId } from "@/hooks/useEvents";
import { ApiErrorMessage } from "@/lib/api/client";
import { MISSING_ORG_MESSAGE } from "@/lib/api/session";
import { feedQuery, organizationQuery } from "@/lib/query/queries";
import { WarmApi } from "@/lib/query/warm";
import { PublishPageWarmups } from "@/lib/query/warmups";
import { usePrefetch } from "@/lib/query/usePrefetch";
import { DashboardEntryWarmups } from "@/components/dashboard/sectionWarmups";
import { useApiQuery } from "@/lib/query/useApiQuery";
import { ApplyOrgColor } from "@/lib/theme/theme";
import { Navbar } from "../Navbar";

/** Paths that take the whole screen (kiosk) and show no bar. */
const BARLESS_PATHS = ["/display"];

/** Sections with their own navigation frame (the dashboard brings brand, theme and logout itself). */
const BARLESS_PREFIXES = ["/dashboard"];

/** Whether `pathname` is a dashboard page. */
function IsDashboard(pathname: string): boolean {
  return BARLESS_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/** Whether `pathname` is shown without the site's top bar. */
function IsBarless(pathname: string): boolean {
  return BARLESS_PATHS.includes(pathname) || IsDashboard(pathname);
}

/**
 * Branding comes from the user's organization when logged in, the public one
 * for visitors, and none for the Superadmin (who sees the app name).
 */
export function NavbarContainer() {
  const pathname = usePathname();
  const { state, user, logout } = useAuth();
  const prefetch = usePrefetch();
  const [logoutError, setLogoutError] = useState<string | null>(null);

  const settled = state.status === "anonymous" || state.status === "authenticated";
  const superadmin = user !== null && user.role === "Superadmin";
  const orgId = settled && !superadmin ? FeedOrgId(user) : null;

  useEffect(() => {
    if (user !== null) prefetch(...DashboardEntryWarmups(user), ...PublishPageWarmups());
  }, [user, prefetch]);

  const org = useApiQuery(organizationQuery(orgId === null ? "" : orgId), { enabled: orgId !== null });
  const orgLoaded = org.value !== null;
  const orgColor = org.value === null ? undefined : org.value.colorScheme;

  // The whole palette (accent, gradients) comes from the organization's color;
  // the Superadmin, who belongs to none, sees the app's default.
  // On dashboard pages the dashboard paints the managed context's color instead.
  const inDashboard = IsDashboard(pathname);
  useEffect(() => {
    if (inDashboard) return;
    if (superadmin) ApplyOrgColor(null);
    else if (orgLoaded) ApplyOrgColor(orgColor);
  }, [inDashboard, superadmin, orgLoaded, orgColor]);

  if (IsBarless(pathname)) return null;

  const missingOrg = settled && !superadmin && orgId === null;
  const orgError = org.error === null ? null : `Não foi possível carregar a organização. ${ApiErrorMessage(org.error)}`;

  return (
    <Navbar
      auth={state}
      brand={org.value === null ? null : { name: org.value.name, logo: org.value.logo === undefined ? null : org.value.logo }}
      brandError={missingOrg ? MISSING_ORG_MESSAGE : orgError}
      pathname={pathname}
      logoutError={logoutError}
      onIntent={(href) => {
        if (user !== null && href === "/dashboard") prefetch(...DashboardEntryWarmups(user));
        else if (href === "/eventos/novo") prefetch(...PublishPageWarmups());
        else if (href === "/" && orgId !== null) prefetch(WarmApi(feedQuery(orgId)));
      }}
      onLogout={() => {
        const result = logout();
        setLogoutError(result.ok ? null : result.error);
      }}
    />
  );
}
