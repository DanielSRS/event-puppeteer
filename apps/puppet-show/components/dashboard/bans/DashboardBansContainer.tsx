'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { BanList, BannedUser } from './BanList';
import { api } from '@/lib/api/client';
import { useDashboard, SelectOrgNotice } from '../DashboardContext';

export function DashboardBansContainer() {
  const { orgId } = useDashboard();
  const [bannedUsers, setBannedUsers] = useState<BannedUser[]>([]);
  const [loadedOrgId, setLoadedOrgId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!orgId) return;
    api.moderation.listShadowBans(orgId)
      .then(users => {
        setBannedUsers(users.map(u => ({
          id: u.id,
          name: `${u.firstName} ${u.lastName}`.trim(),
          email: u.email,
          reason: 'Volume de denúncias acima do limite',
        })));
        setError('');
      })
      .catch(() => setError('Erro ao carregar usuários banidos.'))
      .finally(() => setLoadedOrgId(orgId));
  }, [orgId]);

  const handleLiftBan = (userId: string) => {
    if (!orgId) return;
    startTransition(async () => {
      try {
        await api.moderation.liftShadowBan(orgId, userId);
        setBannedUsers(prev => prev.filter(u => u.id !== userId));
      } catch {
        setError('Não foi possível remover o banimento.');
      }
    });
  };

  if (!orgId) return <SelectOrgNotice />;

  const isLoading = loadedOrgId !== orgId;

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500 animate-pulse">Carregando usuários banidos...</div>;
  }

  return (
    <div className={isPending ? "opacity-50" : ""}>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      <BanList 
        bannedUsers={bannedUsers}
        onLiftBan={handleLiftBan}
      />
    </div>
  );
}
