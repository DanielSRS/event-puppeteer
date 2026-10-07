'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { TagManager, UserTag } from './TagManager';
import { api } from '@/lib/api/client';

export function DashboardTagsContainer() {
  const [tags, setTags] = useState<UserTag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    api.tags.list()
      .then(data => {
        setTags(data.map(t => ({
          id: t.id,
          name: t.name,
          status: t.isSystemDefined ? 'promoted' : 'pending',
        })));
        setError('');
      })
      .catch(() => setError('Erro ao carregar tags.'))
      .finally(() => setIsLoading(false));
  }, []);

  const handlePromoteTag = (tagId: string) => {
    startTransition(async () => {
      try {
        await api.tags.promote(tagId);
        setTags(prev => prev.map(t => t.id === tagId ? { ...t, status: 'promoted' } : t));
      } catch {
        setError('Não foi possível promover a tag.');
      }
    });
  };

  // The API has no reject endpoint yet: the tag only leaves this view and stays free-form
  const handleRejectTag = (tagId: string) => {
    setTags(prev => prev.filter(t => t.id !== tagId));
  };

  if (isLoading) {
    return <div className="p-8 text-center text-foreground/60 animate-pulse">Carregando tags...</div>;
  }

  return (
    <div className={isPending ? "opacity-50" : ""}>
      {error && <p className="mb-4 text-sm text-danger">{error}</p>}
      <TagManager 
        tags={tags}
        onPromoteTag={handlePromoteTag}
        onRejectTag={handleRejectTag}
      />
    </div>
  );
}
