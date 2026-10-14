/**
 * The dashboard navigation: the context switcher and the sections the person
 * may open in the current context (see {@link AccessibleSections}).
 *
 * Shown as a sidebar on larger screens and inside the menu panel on phones.
 *
 * @module
 */

"use client";

import Link from "next/link";
import { useId, type ReactNode } from "react";
import {
  MdBlock, MdDevices, MdEvent, MdHistory, MdLabel, MdLink, MdPeople, MdPublic, MdReport, MdSettings,
  MdDevicesOther, MdNewLabel, MdImageSearch, MdPolicy, MdPhotoLibrary,
} from "react-icons/md";
import type { UserRole } from "@/lib/api/schemas";
import { ContextSwitcher, type ContextOrganization } from "./ContextSwitcher";
import { AccessibleSections, SectionForPath, type DashboardSection } from "./DashboardSections";

/** Icon of each section. */
const ICONS: Record<DashboardSection, ReactNode> = {
  "events": <MdEvent aria-hidden className="icon" />,
  "reports": <MdReport aria-hidden className="icon" />,
  "images": <MdImageSearch aria-hidden className="icon" />,
  "bans": <MdBlock aria-hidden className="icon" />,
  "tags": <MdNewLabel aria-hidden className="icon" />,
  "audit": <MdHistory aria-hidden className="icon" />,
  "users": <MdPeople aria-hidden className="icon" />,
  "devices": <MdDevices aria-hidden className="icon" />,
  "settings": <MdSettings aria-hidden className="icon" />,
  "global-orgs": <MdPublic aria-hidden className="icon" />,
  "global-devices": <MdDevicesOther aria-hidden className="icon" />,
  "global-tags": <MdLabel aria-hidden className="icon" />,
  "global-links": <MdLink aria-hidden className="icon" />,
  "global-images": <MdPhotoLibrary aria-hidden className="icon" />,
  "global-screening": <MdPolicy aria-hidden className="icon" />,
};

/** Heading of the group each section is listed under. */
const GROUPS: { label: string; ids: DashboardSection[] }[] = [
  { label: "Meu espaço", ids: ["events"] },
  { label: "Moderação", ids: ["reports", "images", "bans", "tags"] },
  { label: "Administração", ids: ["audit", "users", "devices", "settings"] },
  { label: "Organizações e totens", ids: ["global-orgs", "global-devices"] },
  { label: "Catálogos", ids: ["global-tags", "global-links"] },
  { label: "Imagens", ids: ["global-images", "global-screening"] },
];

/** Props of {@link DashboardSidebar}. */
export type DashboardSidebarProps = {
  /** Role of the logged-in user. */
  role: UserRole;
  /** Organization being managed; `null` = global context (Superadmin). */
  orgId: string | null;
  /** Name of the current context. */
  contextName: string;
  /** Organizations the context switcher offers. */
  organizations: ContextOrganization[];
  /** Current route, to mark the open section. */
  pathname: string;
  onSelectOrg: (orgId: string | null) => void;
  /** Called when a section link is followed (the phone menu closes itself). */
  onNavigate?: () => void;
  /** Called when the person shows intent to open a section (hover, focus, touch), to load its data beforehand. */
  onIntent?: (section: DashboardSection) => void;
  /** "list" in the sidebar; "tiles" (two columns of larger targets) in the phone menu. */
  variant?: "list" | "tiles";
};

/** Context switcher plus section links. */
export function DashboardSidebar({
  role, orgId, contextName, organizations, pathname, onSelectOrg, onNavigate, onIntent, variant = "list",
}: DashboardSidebarProps) {
  const tiles = variant === "tiles";
  const sections = AccessibleSections({ role }, orgId);
  const active = SectionForPath(pathname);
  const groupId = useId();
  const groups = GROUPS
    .map((group) => ({ ...group, sections: sections.filter((section) => group.ids.includes(section.id)) }))
    .filter((group) => group.sections.length > 0);
  const ungrouped = sections.filter((section) => !GROUPS.some((group) => group.ids.includes(section.id)));
  if (ungrouped.length > 0) groups.push({ label: "Outros", ids: [], sections: ungrouped });

  return (
    <div className="column gap-[18px]">
      <ContextSwitcher
        organizations={organizations}
        currentOrgId={orgId}
        contextName={contextName}
        canSwitch={role === "Superadmin"}
        onSelect={onSelectOrg}
      />

      <nav aria-label="Seções do painel" className="column gap-[18px]">
        {groups.map((group, index) => (
          <div key={group.label} className="column gap-0.5">
            <p id={`${groupId}-${index}`} className={`caption pb-1.5 ${tiles ? "px-1" : "px-3"}`}>{group.label}</p>
            <ul aria-labelledby={`${groupId}-${index}`} className={tiles ? "grid grid-cols-2 gap-2" : "column gap-0.5"}>
              {group.sections.map((section) => {
                const current = section.id === active;
                return (
                  <li key={section.id} className={tiles ? "column" : undefined}>
                    <Link
                      href={section.href}
                      onClick={onNavigate}
                      onMouseEnter={() => onIntent?.(section.id)}
                      onFocus={() => onIntent?.(section.id)}
                      onTouchStart={() => onIntent?.(section.id)}
                      aria-current={current ? "page" : undefined}
                      className={tiles
                        ? "nav-item focus-ring flex-1 flex-col !items-start gap-2.5 min-h-[84px] rounded-[18px] border border-line p-3 text-foreground"
                        : "nav-item focus-ring text-sm"}
                    >
                      {tiles
                        ? <span aria-hidden className="center h-8 w-8 rounded-[10px] surface-2">{ICONS[section.id]}</span>
                        : ICONS[section.id]}
                      <span className={tiles ? "font-semibold leading-tight" : undefined}>{section.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </div>
  );
}
