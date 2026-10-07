'use client';

import React, { useState, useEffect } from 'react';
import { GlobalTagsManager, GlobalTag } from './GlobalTagsManager';
import { api } from '@/lib/api/client';

export function GlobalTagsContainer() {
  const [tags, setTags] = useState<GlobalTag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.tags.list()
      .then(data => {
        setTags(data.filter(t => t.isSystemDefined).map(t => ({ id: t.id, name: t.name })));
        setError('');
      })
      .catch(() => setError('Erro ao carregar tags globais.'))
      .finally(() => setIsLoading(false));
  }, []);

  const handleCreate = async (name: string) => {
    try {
      const tag = await api.tags.create(name, true);
      setTags(prev => [{ id: tag.id, name: tag.name }, ...prev]);
      setError('');
    } catch {
      setError('Não foi possível criar a tag.');
    }
  };

  if (isLoading) return <div className="p-8 text-center text-foreground/60 animate-pulse">Carregando tags globais...</div>;

  return (
    <>
      {error && <p className="mb-4 text-sm text-danger">{error}</p>}
      <GlobalTagsManager 
        tags={tags}
        onCreateTag={handleCreate}
      />
    </>
  );
}
