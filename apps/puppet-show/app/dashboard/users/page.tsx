import React from 'react';
import { DashboardUsersContainer } from '@/components/dashboard/users/DashboardUsersContainer';

export const metadata = {
  title: 'Diretório de Usuários - Dashboard',
};

export default function UsersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Usuários da Organização</h1>
        <p className="mt-1 text-sm text-gray-500">
          Gerencie os membros e seus níveis de acesso no sistema.
        </p>
      </div>

      <DashboardUsersContainer />
    </div>
  );
}
