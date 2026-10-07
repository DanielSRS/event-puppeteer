import React from 'react';
import { GlobalOrgsContainer } from '@/components/dashboard/global/orgs/GlobalOrgsContainer';

export const metadata = {
  title: 'Organizações - Superadmin',
};

export default function OrgsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Tenants (Organizações)</h1>
        <p className="mt-1 text-sm text-gray-500">
          Gerencie todas as organizações cadastradas na plataforma.
        </p>
      </div>

      <GlobalOrgsContainer />
    </div>
  );
}
