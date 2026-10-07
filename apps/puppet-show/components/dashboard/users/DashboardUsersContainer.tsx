'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { UserList, OrgUser, UserRole } from './UserList';
import { api } from '@/lib/api/client';
import { useDashboard, SelectOrgNotice } from '../DashboardContext';

export function DashboardUsersContainer() {
  const { orgId } = useDashboard();
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [loadedOrgId, setLoadedOrgId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!orgId) return;
    api.users.list(orgId)
      .then(data => {
        // Superadmins live above organizations, so they are not managed from this list
        setUsers(data
          .filter(u => u.role !== 'Superadmin')
          .map(u => ({
            id: u.id,
            name: `${u.firstName} ${u.lastName}`.trim(),
            email: u.email,
            role: u.role as UserRole,
          })));
        setError('');
      })
      .catch(() => setError('Erro ao carregar usuários.'))
      .finally(() => setLoadedOrgId(orgId));
  }, [orgId]);

  const handleChangeRole = (userId: string, newRole: UserRole) => {
    if (!orgId) return;
    startTransition(async () => {
      try {
        await api.users.changeRole(orgId, userId, newRole);
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
      } catch {
        setError('Não foi possível alterar o nível de acesso.');
      }
    });
  };

  const handleRemoveUser = (userId: string) => {
    if (!orgId) return;
    if (confirm('Tem certeza que deseja remover este usuário da organização?')) {
      startTransition(async () => {
        try {
          await api.users.remove(orgId, userId);
          setUsers(prev => prev.filter(u => u.id !== userId));
        } catch {
          setError('Não foi possível remover o usuário.');
        }
      });
    }
  };

  if (!orgId) return <SelectOrgNotice />;

  const isLoading = loadedOrgId !== orgId;

  if (isLoading) {
    return <div className="p-8 text-center text-foreground/60 animate-pulse">Carregando usuários...</div>;
  }

  return (
    <div className={isPending ? "opacity-50" : ""}>
      {error && <p className="mb-4 text-sm text-danger">{error}</p>}
      <UserList 
        users={users}
        onChangeRole={handleChangeRole}
        onRemoveUser={handleRemoveUser}
      />
    </div>
  );
}
