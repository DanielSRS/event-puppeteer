/**
 * Connects the top bar to the session and the organization's branding.
 *
 * @module
 */

"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { FeedOrgId } from "@/hooks/useEvents";
import { api, ApiErrorMessage } from "@/lib/api/client";
import { MISSING_ORG_MESSAGE } from "@/lib/api/session";
import { Navbar, type NavBrand } from "../Navbar";

/** Paths that take the whole screen (kiosk) and show no bar. */
const BARLESS_PATHS = ["/display"];

type Brand = { orgId: string; brand: NavBrand } | { orgId: string; error: string };

/**
 * Branding comes from the user's organization when logged in, the public one
 * for visitors, and none for the Superadmin (who sees the app name).
 */
export function NavbarContainer() {
  const pathname = usePathname();
  const { state, user, logout } = useAuth();
  const [loaded, setLoaded] = useState<Brand | null>(null);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  const settled = state.status === "anonymous" || state.status === "authenticated";
  const superadmin = user !== null && user.role === "Superadmin";
  const orgId = settled && !superadmin ? FeedOrgId(user) : null;

  useEffect(() => {
    if (orgId === null) return;
    let active = true;
    api.organizations.get(orgId).then((org) => {
      if (!active) return;
      setLoaded(org.ok
        ? { orgId, brand: { name: org.value.name, logo: org.value.logo === undefined || org.value.logo === "" ? null : org.value.logo } }
        : { orgId, error: `Não foi possível carregar a organização. ${ApiErrorMessage(org.error)}` });
    });
    return () => { active = false; };
  }, [orgId]);

  if (BARLESS_PATHS.includes(pathname)) return null;

  const current = loaded !== null && loaded.orgId === orgId ? loaded : null;
  const missingOrg = settled && !superadmin && orgId === null;

  return (
    <Navbar
      auth={state}
      brand={current !== null && "brand" in current ? current.brand : null}
      brandError={missingOrg ? MISSING_ORG_MESSAGE : current !== null && "error" in current ? current.error : null}
      pathname={pathname}
      logoutError={logoutError}
      onLogout={() => {
        const result = logout();
        setLogoutError(result.ok ? null : result.error);
      }}
    />
  );
}
