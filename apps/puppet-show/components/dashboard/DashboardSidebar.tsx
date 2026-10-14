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
import type { ReactNode } from "react";
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

  return (
    <div className="column gap-4">
      <ContextSwitcher
        organizations={organizations}
        currentOrgId={orgId}
        contextName={contextName}
        canSwitch={role === "Superadmin"}
        onSelect={onSelectOrg}
      />

      <nav aria-label="Seções do painel">
        <ul className="column gap-1">
          {sections.map((section) => {
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
                  className={`row min-h-10 gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                    current ? "bg-main font-semibold text-background" : "hover:bg-white/5"
                  }`}
                >
                  {ICONS[section.id]}
                  <span>{section.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
