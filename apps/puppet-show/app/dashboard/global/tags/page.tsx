import React from 'react';
import { GlobalTagsContainer } from '@/components/dashboard/global/tags/GlobalTagsContainer';

export const metadata = {
  title: 'Tags Globais - Superadmin',
};

export default function GlobalTagsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Tags Globais</h1>
        <p className="mt-1 text-sm text-gray-500">
          Gerencie o dicionário principal de categorias usado por todos os tenants.
        </p>
      </div>

      <GlobalTagsContainer />
    </div>
  );
}
