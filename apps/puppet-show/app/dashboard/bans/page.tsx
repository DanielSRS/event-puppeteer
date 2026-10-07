import React from 'react';
import { DashboardBansContainer } from '@/components/dashboard/bans/DashboardBansContainer';

export const metadata = {
  title: 'Shadow Bans - Dashboard',
};

export default function BansPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="title">Shadow Bans</h1>
        <p className="mt-1 text-sm opacity-60">
          Gerencie usuários que foram banidos automaticamente devido a alto volume de denúncias.
        </p>
      </div>

      <DashboardBansContainer />
    </div>
  );
}
