/**
 * Which dashboard sections exist and who may open them.
 *
 * The rules mirror the API exactly, so the dashboard never offers a page whose
 * requests would be refused:
 * - Meus Eventos: any organization role, and a Superadmin inside an organization.
 * - Denúncias, Imagens em Revisão, Usuários Banidos, Tags Sugeridas: Moderator and above.
 * - Auditoria, Usuários, Dispositivos, Configurações: Admin and above (issue #7).
 * - Organizações, Dispositivos Órfãos, Tags Globais, Links Globais, Imagens
 *   Escalonadas, Política de Triagem: Superadmin in the global context only.
 *
 * A Superadmin can do everything an Admin can in any organization (spec story
 * 30), so organization sections open for them whenever an organization is
 * selected. Everyone else always works inside their own organization.
 *
 * @module
 */

import type { UserRole } from "@/lib/api/schemas";

/** Identifier of a dashboard section. */
export type DashboardSection =
  | "events"
  | "reports"
  | "images"
  | "bans"
  | "tags"
  | "audit"
  | "users"
  | "devices"
  | "settings"
  | "global-orgs"
  | "global-devices"
  | "global-tags"
  | "global-links"
  | "global-images"
  | "global-screening";

/** Where a section lives and what it is called in the navigation. */
export type DashboardSectionInfo = {
  id: DashboardSection;
  /** Name shown in the navigation, in Portuguese. */
  label: string;
  /** Route of the section's main page. */
  href: string;
};

/**
 * Minimum role an organization section requires, or `"global"` for the
 * Superadmin-only sections of the global context.
 */
type SectionRequirement = "Member" | "Moderator" | "Admin" | "global";

/** A section and what it requires. */
type SectionDefinition = DashboardSectionInfo & { requires: SectionRequirement };

/** Every section with what it requires; the key order is the navigation order. */
const SECTIONS: Record<DashboardSection, SectionDefinition> = {
  "events": { id: "events", label: "Meus Eventos", href: "/dashboard/events", requires: "Member" },
  "reports": { id: "reports", label: "Denúncias", href: "/dashboard/reports", requires: "Moderator" },
  "images": { id: "images", label: "Imagens em Revisão", href: "/dashboard/images", requires: "Moderator" },
  "bans": { id: "bans", label: "Usuários Banidos", href: "/dashboard/bans", requires: "Moderator" },
  "tags": { id: "tags", label: "Tags Sugeridas", href: "/dashboard/tags", requires: "Moderator" },
  "audit": { id: "audit", label: "Auditoria", href: "/dashboard/audit", requires: "Admin" },
  "users": { id: "users", label: "Usuários", href: "/dashboard/users", requires: "Admin" },
  "devices": { id: "devices", label: "Dispositivos", href: "/dashboard/devices", requires: "Admin" },
  "settings": { id: "settings", label: "Configurações", href: "/dashboard/settings", requires: "Admin" },
  "global-orgs": { id: "global-orgs", label: "Organizações", href: "/dashboard/global/orgs", requires: "global" },
  "global-devices": { id: "global-devices", label: "Dispositivos Órfãos", href: "/dashboard/global/devices", requires: "global" },
  "global-tags": { id: "global-tags", label: "Tags Globais", href: "/dashboard/global/tags", requires: "global" },
  "global-links": { id: "global-links", label: "Links Globais", href: "/dashboard/global/links", requires: "global" },
  "global-images": { id: "global-images", label: "Imagens Escalonadas", href: "/dashboard/global/images", requires: "global" },
  "global-screening": { id: "global-screening", label: "Política de Triagem", href: "/dashboard/global/screening", requires: "global" },
};

/** Every section in navigation order. */
const SECTION_LIST: ReadonlyArray<SectionDefinition> = Object.values(SECTIONS);

/** Rank of each organization role; higher can do everything lower can. */
const ROLE_RANK: Record<UserRole, number> = { Member: 1, Moderator: 2, Admin: 3, Superadmin: 4 };

/** Why a section can't be opened in the current context. */
export type SectionDenial =
  /** The role is too low for this section. */
  | "role"
  /** A Superadmin in the global context opened an organization section: an organization must be picked. */
  | "needs-org"
  /** A Superadmin inside an organization opened a global section: the global context must be picked. */
  | "needs-global";

/**
 * Why `user` can't open `section` in the context `orgId`, or `null` when they can.
 *
 * @param orgId - Organization being managed; `null` is the Superadmin's global context.
 */
export function SectionDenialFor(section: DashboardSection, user: { role: UserRole }, orgId: string | null): SectionDenial | null {
  const info = SECTIONS[section];

  if (info.requires === "global") {
    if (user.role !== "Superadmin") return "role";
    return orgId === null ? null : "needs-global";
  }

  if (ROLE_RANK[user.role] < ROLE_RANK[info.requires]) return "role";
  if (orgId === null) return "needs-org";
  return null;
}

/**
 * Whether `user` may open `section` while managing `orgId` (`null` = the
 * Superadmin's global context). Pages and navigation use this one rule.
 */
export function CanAccess(section: DashboardSection, user: { role: UserRole }, orgId: string | null): boolean {
  return SectionDenialFor(section, user, orgId) === null;
}

/** The sections `user` may open in the context `orgId`, in navigation order. */
export function AccessibleSections(user: { role: UserRole }, orgId: string | null): DashboardSectionInfo[] {
  return SECTION_LIST.filter((section) => CanAccess(section.id, user, orgId)).map(({ id, label, href }) => ({ id, label, href }));
}

/** Name and route of a section. */
export function SectionInfo(section: DashboardSection): DashboardSectionInfo {
  const { id, label, href } = SECTIONS[section];
  return { id, label, href };
}

/**
 * The section a dashboard route belongs to (its own page or a page below it,
 * e.g. `/dashboard/devices/abc` is in "devices"), or `null` for routes that
 * aren't inside a section (such as `/dashboard` itself).
 */
export function SectionForPath(pathname: string): DashboardSection | null {
  const match = SECTION_LIST
    .filter((section) => pathname === section.href || pathname.startsWith(`${section.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return match === undefined ? null : match.id;
}
