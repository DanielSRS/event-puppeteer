import React from "react";
import { MdSwapVert, MdDomain, MdPublic } from "react-icons/md";

export type Organization = {
  id: string;
  name: string;
  acronym: string;
};

export type ContextSwitcherProps = {
  organizations: Organization[];
  currentOrgId?: string;
  isSuperadmin?: boolean;
  onSelectOrg: (id: string | null) => void;
};

export function ContextSwitcher({
  organizations,
  currentOrgId,
  isSuperadmin,
  onSelectOrg,
}: ContextSwitcherProps) {
  const currentOrg = organizations.find((o) => o.id === currentOrgId);

  return (
    <div className="relative group">
      <button
        type="button"
        className="row gap-2 w-full p-2 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-left"
      >
        <div className="center w-8 h-8 rounded-md bg-main text-white shrink-0">
          {currentOrg ? (
            <span className="font-bold text-xs">{currentOrg.acronym}</span>
          ) : (
            <MdPublic className="icon" />
          )}
        </div>
        <div className="column flex-1 min-w-0">
          <span className="text-sm font-semibold truncate">
            {currentOrg ? currentOrg.name : "Sistema Global"}
          </span>
          <span className="text-xs opacity-60">Trocar contexto</span>
        </div>
        <MdSwapVert className="icon opacity-60" />
      </button>

      {/* DROPDOWN MENU */}
      <div className="absolute top-full left-0 w-full mt-1 bg-white dark:bg-zinc-900 border border-muted rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 column p-1">
        {isSuperadmin && (
          <button
            type="button"
            onClick={() => onSelectOrg(null)}
            className={`row gap-2 p-2 rounded-sm hover:bg-black/5 dark:hover:bg-white/5 text-sm ${!currentOrgId ? "text-main font-semibold bg-main/5" : ""}`}
          >
            <MdPublic className="icon shrink-0" />
            <span className="truncate">Sistema Global</span>
          </button>
        )}
        
        {organizations.map((org) => (
          <button
            key={org.id}
            type="button"
            onClick={() => onSelectOrg(org.id)}
            className={`row gap-2 p-2 rounded-sm hover:bg-black/5 dark:hover:bg-white/5 text-sm ${currentOrgId === org.id ? "text-main font-semibold bg-main/5" : ""}`}
          >
            <MdDomain className="icon shrink-0" />
            <span className="truncate">{org.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
