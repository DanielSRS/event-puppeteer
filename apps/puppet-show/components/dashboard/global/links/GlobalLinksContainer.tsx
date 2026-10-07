'use client';

import React, { useState, useEffect } from 'react';
import { GlobalLinksManager, GlobalLinkDef } from './GlobalLinksManager';
import { api } from '@/lib/api/client';

export function GlobalLinksContainer() {
  const [links, setLinks] = useState<GlobalLinkDef[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.linkLabels.list()
      .then(data => {
        setLinks(data.map(l => ({ id: l.id, label: l.name })));
        setError('');
      })
      .catch(() => setError('Erro ao carregar rótulos.'))
      .finally(() => setIsLoading(false));
  }, []);

  const handleCreate = async (label: string) => {
    try {
      const created = await api.linkLabels.create(label);
      setLinks(prev => [{ id: created.id, label: created.name }, ...prev]);
      setError('');
    } catch {
      setError('Não foi possível criar o rótulo.');
    }
  };

  if (isLoading) return <div className="p-8 text-center text-foreground/60 animate-pulse">Carregando links...</div>;

  return (
    <>
      {error && <p className="mb-4 text-sm text-danger">{error}</p>}
      <GlobalLinksManager 
        links={links}
        onCreateLink={handleCreate}
      />
    </>
  );
}
