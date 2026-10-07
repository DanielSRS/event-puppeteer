import React from 'react';
import { MdDomain, MdColorLens, MdEdit } from 'react-icons/md';

export interface Tenant {
  id: string;
  name: string;
  acronym: string;
  domain: string;
  primaryColor: string;
}

interface OrgManagerProps {
  organizations: Tenant[];
  onEditOrg: (id: string) => void;
  onCreateOrg: () => void;
}

export function OrgManager({ organizations, onEditOrg, onCreateOrg }: OrgManagerProps) {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <MdDomain className="w-6 h-6 text-foreground/60" />
          <h2 className="text-lg font-medium text-foreground">Tenants do Sistema</h2>
        </div>
        <button
          onClick={onCreateOrg}
          className="px-4 py-2 bg-main text-background rounded-md text-sm font-medium hover:opacity-90"
        >
          Nova Organização
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {organizations.map(org => (
          <div key={org.id} className="bg-surface p-6 rounded-lg shadow-sm border border-muted">
            <div className="flex justify-between items-start mb-4">
              <div 
                className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-xl"
                style={{ backgroundColor: org.primaryColor }}
              >
                {org.acronym}
              </div>
              <button
                onClick={() => onEditOrg(org.id)}
                className="p-1.5 text-foreground/50 hover:text-main rounded-md hover:bg-main/20"
              >
                <MdEdit className="w-5 h-5" />
              </button>
            </div>
            
            <h3 className="font-semibold text-lg text-foreground">{org.name}</h3>
            <p className="text-sm text-foreground/60">{org.domain}</p>
            
            <div className="mt-4 flex items-center gap-2 text-xs text-foreground/60 border-t pt-4 border-muted">
              <MdColorLens className="w-4 h-4" />
              <span className="flex items-center gap-1">
                Cor Principal: 
                <span className="w-3 h-3 rounded-full border border-muted" style={{ backgroundColor: org.primaryColor }} />
                <span className="font-mono">{org.primaryColor}</span>
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
