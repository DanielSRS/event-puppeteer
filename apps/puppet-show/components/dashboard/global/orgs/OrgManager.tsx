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
          <MdDomain className="w-6 h-6 text-gray-500" />
          <h2 className="text-lg font-medium text-gray-900">Tenants do Sistema</h2>
        </div>
        <button
          onClick={onCreateOrg}
          className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
        >
          Nova Organização
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {organizations.map(org => (
          <div key={org.id} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex justify-between items-start mb-4">
              <div 
                className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-xl"
                style={{ backgroundColor: org.primaryColor }}
              >
                {org.acronym}
              </div>
              <button
                onClick={() => onEditOrg(org.id)}
                className="p-1.5 text-gray-400 hover:text-blue-600 rounded-md hover:bg-blue-50"
              >
                <MdEdit className="w-5 h-5" />
              </button>
            </div>
            
            <h3 className="font-semibold text-lg text-gray-900">{org.name}</h3>
            <p className="text-sm text-gray-500">{org.domain}</p>
            
            <div className="mt-4 flex items-center gap-2 text-xs text-gray-500 border-t pt-4">
              <MdColorLens className="w-4 h-4" />
              <span className="flex items-center gap-1">
                Cor Principal: 
                <span className="w-3 h-3 rounded-full border border-gray-300" style={{ backgroundColor: org.primaryColor }} />
                <span className="font-mono">{org.primaryColor}</span>
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
