import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  MdEvent, 
  MdReport, 
  MdBlock, 
  MdLabel, 
  MdHistory, 
  MdPeople, 
  MdDevices, 
  MdSettings,
  MdPublic,
  MdLink
} from "react-icons/md";
import { ContextSwitcher, type Organization } from "./ContextSwitcher";

export type Role = "MEMBER" | "MODERATOR" | "ADMIN" | "SUPERADMIN";

type NavItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
  roles: Role[];
  globalOnly?: boolean;
  orgOnly?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  // Member
  { label: "Meus Eventos", href: "/dashboard/events", icon: <MdEvent />, roles: ["MEMBER", "MODERATOR", "ADMIN"], orgOnly: true },
  
  // Moderator
  { label: "Denúncias", href: "/dashboard/reports", icon: <MdReport />, roles: ["MODERATOR", "ADMIN"], orgOnly: true },
  { label: "Usuários Banidos", href: "/dashboard/bans", icon: <MdBlock />, roles: ["MODERATOR", "ADMIN"], orgOnly: true },
  { label: "Tags Sugeridas", href: "/dashboard/tags", icon: <MdLabel />, roles: ["MODERATOR", "ADMIN"], orgOnly: true },
  { label: "Auditoria", href: "/dashboard/audit", icon: <MdHistory />, roles: ["MODERATOR", "ADMIN"], orgOnly: true },
  
  // Admin
  { label: "Usuários", href: "/dashboard/users", icon: <MdPeople />, roles: ["ADMIN"], orgOnly: true },
  { label: "Dispositivos", href: "/dashboard/devices", icon: <MdDevices />, roles: ["ADMIN"], orgOnly: true },
  { label: "Configurações", href: "/dashboard/settings", icon: <MdSettings />, roles: ["ADMIN"], orgOnly: true },

  // Superadmin (Global)
  { label: "Organizações", href: "/dashboard/global/orgs", icon: <MdPublic />, roles: ["SUPERADMIN"], globalOnly: true },
  { label: "Dispositivos Órfãos", href: "/dashboard/global/devices", icon: <MdDevices />, roles: ["SUPERADMIN"], globalOnly: true },
  { label: "Tags Globais", href: "/dashboard/global/tags", icon: <MdLabel />, roles: ["SUPERADMIN"], globalOnly: true },
  { label: "Links Globais", href: "/dashboard/global/links", icon: <MdLink />, roles: ["SUPERADMIN"], globalOnly: true },
];

export type DashboardSidebarProps = {
  userRole: Role;
  organizations: Organization[];
  currentOrgId?: string;
  onSelectOrg: (id: string | null) => void;
};

export function DashboardSidebar({ userRole, organizations, currentOrgId, onSelectOrg }: DashboardSidebarProps) {
  const pathname = usePathname() || "";
  const isGlobal = !currentOrgId;

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (!item.roles.includes(userRole)) return false;
    if (isGlobal && item.orgOnly) return false;
    if (!isGlobal && item.globalOnly) return false;
    return true;
  });

  return (
    <aside className="w-64 border-r border-muted bg-background/50 column h-full shrink-0">
      <div className="p-4 border-b border-muted">
        <ContextSwitcher 
          organizations={organizations} 
          currentOrgId={currentOrgId} 
          isSuperadmin={userRole === "SUPERADMIN"}
          onSelectOrg={onSelectOrg}
        />
      </div>

      <nav className="flex-1 overflow-y-auto p-4 column gap-1">
        {visibleItems.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link 
              key={item.href} 
              href={item.href}
              className={`row gap-3 p-2 rounded-md transition-colors ${active ? "bg-main text-background font-semibold" : "hover:bg-white/5 opacity-80 hover:opacity-100"}`}
            >
              <span className="icon text-lg">{item.icon}</span>
              <span className="text-sm">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
