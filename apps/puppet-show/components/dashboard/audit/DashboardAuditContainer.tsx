'use client';

import React, { useState, useEffect } from 'react';
import { AuditList, AuditLog } from './AuditList';
import { api } from '@/lib/api/client';
import type { AuditAction, User } from '@/lib/api/types';
import { useDashboard, SelectOrgNotice } from '../DashboardContext';

const ACTIONS: Record<AuditAction, string> = {
  hide_event: 'Evento Ocultado',
  unhide_event: 'Evento Reexibido',
  apply_shadow_ban: 'Shadow Ban Aplicado',
  lift_shadow_ban: 'Banimento Removido',
  promote_tag: 'Tag Promovida',
  update_org_threshold: 'Limite de Denúncias Alterado',
};

function FormatDetails(details?: Record<string, unknown>) {
  if (!details) return undefined;
  return Object.entries(details).map(([key, value]) => `${key}: ${String(value)}`).join(' • ');
}

export function DashboardAuditContainer() {
  const { orgId } = useDashboard();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loadedOrgId, setLoadedOrgId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!orgId) return;
    // Entries only carry the actor id; the user directory (when allowed) gives names
    Promise.all([
      api.moderation.listAudit(orgId),
      api.users.list(orgId).catch(() => [] as User[]),
    ])
      .then(([entries, users]) => {
        const byId = new Map(users.map(u => [u.id, u]));
        setLogs(entries.map(e => {
          const actor = byId.get(e.actorId);
          return {
            id: e.id,
            action: ACTIONS[e.action] ?? e.action,
            actorName: actor ? `${actor.firstName} ${actor.lastName}`.trim() : e.actorId,
            actorEmail: actor?.email ?? '',
            targetId: e.targetId,
            timestamp: e.createdAt,
            details: FormatDetails(e.details),
          };
        }));
        setError('');
      })
      .catch(() => setError('Erro ao carregar logs de auditoria.'))
      .finally(() => setLoadedOrgId(orgId));
  }, [orgId]);

  if (!orgId) return <SelectOrgNotice />;

  const isLoading = loadedOrgId !== orgId;

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500 animate-pulse">Carregando logs de auditoria...</div>;
  }

  return (
    <>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      <AuditList logs={logs} />
    </>
  );
}
