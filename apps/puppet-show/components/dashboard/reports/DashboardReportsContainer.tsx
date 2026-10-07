'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { ReportList, Report } from './ReportList';
import { api } from '@/lib/api/client';
import type { Report as ApiReport } from '@/lib/api/types';
import { useDashboard, SelectOrgNotice } from '../DashboardContext';

const REASONS: Record<ApiReport['reason'], string> = {
  spam: 'Spam',
  offensive_content: 'Conteúdo ofensivo',
  incorrect_information: 'Informação incorreta',
  duplicate: 'Duplicado',
};

export function DashboardReportsContainer() {
  const { orgId } = useDashboard();
  const [reports, setReports] = useState<Report[]>([]);
  const [loadedOrgId, setLoadedOrgId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!orgId) return;
    // Reports only carry the event id, so the event list fills in title and visibility
    Promise.all([api.moderation.listReports(orgId), api.events.list(orgId)])
      .then(([data, events]) => {
        const byId = new Map(events.map(e => [e.id, e]));
        setReports(data.map(r => ({
          id: r.id,
          eventId: r.eventId,
          eventTitle: byId.get(r.eventId)?.title ?? 'Evento indisponível',
          reason: REASONS[r.reason] ?? r.reason,
          comment: r.comment,
          reportedAt: r.createdAt,
          status: 'pending',
          eventIsHidden: byId.get(r.eventId)?.isHidden ?? false,
        })));
        setError('');
      })
      .catch(() => setError('Erro ao carregar denúncias.'))
      .finally(() => setLoadedOrgId(orgId));
  }, [orgId]);

  const handleToggleVisibility = (eventId: string, currentHiddenStatus: boolean) => {
    if (!orgId) return;
    startTransition(async () => {
      try {
        const event = currentHiddenStatus
          ? await api.events.unhide(orgId, eventId)
          : await api.events.hide(orgId, eventId);
        setReports(prev =>
          prev.map(r => r.eventId === eventId ? { ...r, eventIsHidden: event.isHidden } : r)
        );
      } catch {
        setError('Não foi possível alterar a visibilidade do evento.');
      }
    });
  };

  // The API has no "resolve" endpoint yet: dismissing only clears the report from this view
  const handleResolveReport = (reportId: string) => {
    setReports(prev => prev.filter(r => r.id !== reportId));
  };

  if (!orgId) return <SelectOrgNotice />;

  const isLoading = loadedOrgId !== orgId;

  if (isLoading) {
    return <div className="p-8 text-center text-foreground/60 animate-pulse">Carregando denúncias...</div>;
  }

  return (
    <div className={isPending ? "opacity-50" : ""}>
      {error && <p className="mb-4 text-sm text-danger">{error}</p>}
      <ReportList 
        reports={reports}
        onToggleVisibility={handleToggleVisibility}
        onResolveReport={handleResolveReport}
      />
    </div>
  );
}
