import React from 'react';
import { GlobalLinksContainer } from '@/components/dashboard/global/links/GlobalLinksContainer';

export const metadata = {
  title: 'Links Globais - Superadmin',
};

export default function GlobalLinksPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="title">Rótulos de Links</h1>
        <p className="mt-1 text-sm opacity-60">
          Gerencie os rótulos de links externos que os usuários podem adicionar aos seus eventos.
        </p>
      </div>

      <GlobalLinksContainer />
    </div>
  );
}
