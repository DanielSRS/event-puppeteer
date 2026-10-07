/* components/dashboard/DashboardContainer.tsx */

"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api/client";
import type { Organization as ApiOrganization, UserRole } from "@/lib/api/types";
import { DashboardLayout } from "./DashboardLayout";
import { DashboardProvider } from "./DashboardContext";
import type { Organization } from "./ContextSwitcher";
import type { Role } from "./DashboardSidebar";

const ROLES: Record<UserRole, Role> = {
  Superadmin: "SUPERADMIN",
  Admin: "ADMIN",
  Moderator: "MODERATOR",
  Member: "MEMBER",
};

function ToSwitcherOrg(org: ApiOrganization): Organization {
  return { id: org.id, name: org.name, acronym: org.slug.slice(0, 4).toUpperCase() };
};

export function DashboardContainer({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  /* undefined = NOTHING PICKED YET, SO THE USER'S OWN ORGANIZATION; null = GLOBAL CONTEXT */
  const [selectedOrgId, setSelectedOrgId] = useState<string | null | undefined>(undefined);
  const currentOrgId = selectedOrgId === undefined ? user?.organizationId ?? null : selectedOrgId;

  /* THE DASHBOARD IS PRIVATE: NO SESSION GOES TO LOGIN AND COMES BACK HERE */
  useEffect(() => {
    if (!loading && !user)
      router.replace(`/entrar?redirect=${encodeURIComponent(pathname ?? "/dashboard")}`);
  }, [loading, user, router, pathname]);

  useEffect(() => {
    if (!user)
      return;

    /* ONLY THE SUPERADMIN SWITCHES BETWEEN ORGANIZATIONS; EVERYONE ELSE SEES THEIR OWN */
    const load = user.role === "Superadmin"
      ? api.organizations.list()
      : api.organizations.get(user.organizationId).then((org) => [org]);

    load
      .then((orgs) => setOrganizations(orgs.map(ToSwitcherOrg)))
      .catch(() => setOrganizations([]));
  }, [user]);

  if (loading || !user)
    return <div className="p-8 text-center text-gray-500 animate-pulse">Carregando painel...</div>;

  return (
    <DashboardProvider value={{ user, orgId: currentOrgId }}>
      <DashboardLayout
        userRole={ROLES[user.role]}
        organizations={organizations}
        currentOrgId={currentOrgId ?? undefined}
        onSelectOrg={setSelectedOrgId}
      >
        {children}
      </DashboardLayout>
    </DashboardProvider>
  );
};
