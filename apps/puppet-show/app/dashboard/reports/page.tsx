import React from 'react';
import { DashboardReportsContainer } from '@/components/dashboard/reports/DashboardReportsContainer';

export const metadata = {
  title: 'Fila de Denúncias - Dashboard',
};

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="title">Fila de Denúncias</h1>
        <p className="mt-1 text-sm opacity-60">
          Revise eventos sinalizados pelos usuários.
        </p>
      </div>

      <DashboardReportsContainer />
    </div>
  );
}
