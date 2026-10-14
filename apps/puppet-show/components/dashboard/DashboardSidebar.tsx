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
import { ThemeToggle } from "@/components/ui/theme-toggle";
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
  { label: "Sistema global", ids: ["global-orgs", "global-devices", "global-images", "global-screening", "global-tags", "global-links"] },
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
};

/** Context switcher plus section links. */
export function DashboardSidebar({
  role, orgId, contextName, organizations, pathname, onSelectOrg, onNavigate, onIntent,
}: DashboardSidebarProps) {
  const sections = AccessibleSections({ role }, orgId);
  const active = SectionForPath(pathname);
  const groupId = useId();
  const groups = GROUPS
    .map((group) => ({ ...group, sections: sections.filter((section) => group.ids.includes(section.id)) }))
    .filter((group) => group.sections.length > 0);
  const ungrouped = sections.filter((section) => !GROUPS.some((group) => group.ids.includes(section.id)));
  if (ungrouped.length > 0) groups.push({ label: "Outros", ids: [], sections: ungrouped });

  return (
    <div className="column gap-5">
      <ContextSwitcher
        organizations={organizations}
        currentOrgId={orgId}
        contextName={contextName}
        canSwitch={role === "Superadmin"}
        onSelect={onSelectOrg}
      />

      <nav aria-label="Seções do painel" className="column gap-4">
        {groups.map((group, index) => (
          <div key={group.label} className="column gap-1">
            <p id={`${groupId}-${index}`} className="label-mono px-3 pb-1">{group.label}</p>
            <ul aria-labelledby={`${groupId}-${index}`} className="column gap-0.5">
              {group.sections.map((section) => {
                const current = section.id === active;
                return (
                  <li key={section.id}>
                    <Link
                      href={section.href}
                      onClick={onNavigate}
                      onMouseEnter={() => onIntent?.(section.id)}
                      onFocus={() => onIntent?.(section.id)}
                      onTouchStart={() => onIntent?.(section.id)}
                      aria-current={current ? "page" : undefined}
                      className={`row min-h-11 gap-3 rounded-2xl px-3 py-2 text-sm transition-colors focus-ring ${
                        current ? "bg-accent font-semibold text-on-accent" : "text-foreground/85 hover:bg-foreground/8 hover:text-foreground"
                      }`}
                    >
                      {ICONS[section.id]}
                      <span>{section.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="between gap-2 border-t border-muted pt-4 px-1">
        <span className="text-sm text-foreground/75">Tema</span>
        <ThemeToggle compact />
      </div>
    </div>
  );
}
