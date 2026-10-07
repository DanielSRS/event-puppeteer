import React from 'react';
import { GlobalOrgsContainer } from '@/components/dashboard/global/orgs/GlobalOrgsContainer';

export const metadata = {
  title: 'Organizações - Superadmin',
};

export default function OrgsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="title">Tenants (Organizações)</h1>
        <p className="mt-1 text-sm opacity-60">
          Gerencie todas as organizações cadastradas na plataforma.
        </p>
      </div>

      <GlobalOrgsContainer />
    </div>
  );
}
