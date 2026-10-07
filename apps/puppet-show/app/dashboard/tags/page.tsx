import React from 'react';
import { DashboardTagsContainer } from '@/components/dashboard/tags/DashboardTagsContainer';

export const metadata = {
  title: 'Gestão de Tags - Dashboard',
};

export default function TagsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Gestão de Tags</h1>
        <p className="mt-1 text-sm text-gray-500">
          Revise e promova tags sugeridas pelos usuários para o conjunto público global.
        </p>
      </div>

      <DashboardTagsContainer />
    </div>
  );
}
