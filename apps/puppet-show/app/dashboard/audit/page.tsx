import React from 'react';
import { DashboardAuditContainer } from '@/components/dashboard/audit/DashboardAuditContainer';

export const metadata = {
  title: 'Auditoria - Dashboard',
};

export default function AuditPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Registro de Auditoria</h1>
        <p className="mt-1 text-sm text-gray-500">
          Log imutável de todas as ações de moderação e administração.
        </p>
      </div>

      <DashboardAuditContainer />
    </div>
  );
}
