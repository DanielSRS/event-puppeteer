"use client";

import React from "react";
import { DashboardSidebar, type Role } from "./DashboardSidebar";
import type { Organization } from "./ContextSwitcher";


type DashboardLayoutProps = {
  children: React.ReactNode;
  userRole: Role;
  organizations: Organization[];
  currentOrgId?: string;
  onSelectOrg: (id: string | null) => void;
};

export function DashboardLayout({ children, userRole, organizations, currentOrgId, onSelectOrg }: DashboardLayoutProps) {

  return (
    <div className="flex flex-1 min-h-0 w-full h-full">
        <DashboardSidebar 
          userRole={userRole} 
          organizations={organizations} 
          currentOrgId={currentOrgId}
          onSelectOrg={onSelectOrg}
        />
        
        <main className="flex-1 overflow-y-auto bg-white/[0.03]">
          <div className="p-8 max-w-6xl mx-auto w-full">
            {children}
          </div>
        </main>
    </div>
  );
}
