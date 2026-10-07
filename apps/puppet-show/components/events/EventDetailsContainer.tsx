'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { EventDetails, EventDetailData } from './EventDetails';
import { ReportForm, ReportFormData } from './ReportForm';
import { Drawer } from '@/components/ui/Drawer';
import { useAuth } from '@/hooks/useAuth';
import { api, ApiError } from '@/lib/api/client';
import { MISSING_ORG_MESSAGE, PUBLIC_ORG_ID } from '@/lib/api/session';
import { UserOrgId } from '@/lib/api/types';

interface Props {
  eventId: string;
}

export function EventDetailsContainer({ eventId }: Props) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const orgId = UserOrgId(user) ?? PUBLIC_ORG_ID;

  const [event, setEvent] = useState<EventDetailData | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isReporting, setIsReporting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [reportError, setReportError] = useState('');

  useEffect(() => {
    if (authLoading || !orgId) return;

    // The event only carries tag/label ids, so the catalogs give their names
    Promise.all([api.events.get(orgId, eventId), api.tags.list(), api.linkLabels.list()])
      .then(([e, tags, labels]) => {
        const tagNames = new Map(tags.map(t => [t.id, t.name]));
        const labelNames = new Map(labels.map(l => [l.id, l.name]));
        setEvent({
          id: e.id,
          title: e.title,
          description: e.description,
          location: e.location,
          bannerUrl: e.bannerImage,
          schedule: [...e.schedule]
            .sort((a, b) => a.date.localeCompare(b.date))
            .map(day => ({ date: day.date, startTime: day.startTime, endTime: day.endTime })),
          tags: e.tags.map(t => tagNames.get(t.tagId) ?? t.tagId),
          links: e.links.map(l => ({ id: l.labelId, label: labelNames.get(l.labelId) ?? 'Link', url: l.url })),
        });
      })
      .catch(err => setError(err instanceof ApiError && err.status === 404
        ? 'Evento não encontrado.'
        : 'Erro ao carregar o evento.'));
  }, [authLoading, orgId, eventId]);

  const handleReport = () => {
    if (!user) {
      router.push(`/entrar?redirect=/eventos/${eventId}`);
      return;
    }
    if (!orgId) return;
    setReportError('');
    setIsReporting(true);
  };

  const handleSendReport = async (data: ReportFormData) => {
    if (!orgId) return;
    setIsSending(true);
    setReportError('');
    try {
      await api.events.report(orgId, eventId, data);
      setIsReporting(false);
      setNotice('Denúncia enviada. Obrigado por ajudar a moderar o mural.');
    } catch {
      setReportError('Não foi possível enviar a denúncia.');
    } finally {
      setIsSending(false);
    }
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setNotice('Link copiado para a área de transferência!');
    } catch {
      setNotice('Não foi possível copiar o link.');
    }
  };

  if (!authLoading && !orgId) return <div className="p-12 text-center text-foreground/60">{MISSING_ORG_MESSAGE}</div>;
  if (error) return <div className="p-12 text-center text-foreground/60">{error}</div>;
  if (!event) return <div className="p-12 text-center text-foreground/60 animate-pulse">Carregando detalhes do evento...</div>;

  return (
    <>
      {notice && <p role="status" className="max-w-4xl mx-auto mb-4 text-sm text-success">{notice}</p>}
      <EventDetails 
        event={event}
        onReport={handleReport}
        onShare={handleShare}
      />

      <Drawer isOpen={isReporting} onClose={() => !isSending && setIsReporting(false)} title="Denunciar evento">
        <ReportForm
          isSending={isSending}
          error={reportError}
          onSubmit={handleSendReport}
          onCancel={() => setIsReporting(false)}
        />
      </Drawer>
    </>
  );
}
