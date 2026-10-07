import React from 'react';
import { DashboardSettingsContainer } from '@/components/dashboard/settings/DashboardSettingsContainer';

export const metadata = {
  title: 'Configurações - Dashboard',
};

export default function SettingsPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Configurações da Organização</h1>
        <p className="mt-1 text-sm text-gray-500">
          Ajuste os limites e comportamentos automáticos do sistema para a sua organização.
        </p>
      </div>

      <DashboardSettingsContainer />
    </div>
  );
}
