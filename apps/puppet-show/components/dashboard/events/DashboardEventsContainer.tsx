'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { UserEventList, type UserEventItem } from './UserEventList';
import { Drawer } from '@/components/ui/Drawer';
import { EventWizard } from './EventWizard';
import { api } from '@/lib/api/client';
import { ToCreateEventInput, ToEventItem } from '@/lib/api/mappers';
import type { EventFormData } from '@/utils/validation/EventValidation';
import { useDashboard, SelectOrgNotice } from '../DashboardContext';

export function DashboardEventsContainer() {
  // The selected organization: a member's own, or the one a Superadmin picked
  const { user, orgId } = useDashboard();
  const authorName = `${user.firstName} ${user.lastName}`.trim();

  const [events, setEvents] = useState<UserEventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [isPending, startTransition] = useTransition();

  // Bumping this asks the effect below to fetch the list again (e.g. after creating an event)
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!orgId) return;
    const today = new Date().toISOString().slice(0, 10);
    api.events.list(orgId)
      .then(data => {
        setEvents(data
          .filter(e => e.creatorId === user.id && !e.isDeleted)
          .map(e => {
            const isPast = e.schedule.every(day => day.date < today);
            return {
              ...ToEventItem(e),
              authorName,
              status: e.isHidden ? 'HIDDEN' : isPast ? 'PAST' : 'ACTIVE',
            };
          }));
        setError('');
      })
      .catch(() => setError('Erro ao carregar seus eventos.'))
      .finally(() => setLoading(false));
  }, [orgId, user.id, authorName, reloadKey]);

  const handleDelete = (id: string) => {
    if (!orgId) return;
    if (!confirm('Tem certeza que deseja excluir este evento?')) return;
    startTransition(async () => {
      try {
        await api.events.delete(orgId, id);
        setEvents(prev => prev.filter(e => e.id !== id));
      } catch {
        setError('Não foi possível excluir o evento.');
      }
    });
  };

  const handleSaveEvent = async (data: EventFormData) => {
    if (!orgId) return;
    setSaving(true);
    setSaveError('');
    try {
      await api.events.create(orgId, ToCreateEventInput(data));
      setReloadKey(k => k + 1);
      setIsWizardOpen(false);
    } catch {
      setSaveError('Erro ao salvar o evento.');
    } finally {
      setSaving(false);
    }
  };

  if (!orgId) return <SelectOrgNotice />;

  return (
    <div className="column gap-6">
      <div className="between items-center">
        <h1 className="title">Meus Eventos</h1>
        <button className="button main" onClick={() => { setSaveError(''); setIsWizardOpen(true); }}>Novo Evento</button>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <UserEventList
        events={events}
        loading={loading || isPending}
        onEdit={() => {}}
        onDelete={handleDelete}
      />

      <Drawer
        isOpen={isWizardOpen}
        onClose={() => !saving && setIsWizardOpen(false)}
        title="Criar Novo Evento"
        width="lg"
      >
        <EventWizard
          loading={saving}
          generalError={saveError}
          onSave={handleSaveEvent}
          onCancel={() => setIsWizardOpen(false)}
        />
      </Drawer>
    </div>
  );
}
