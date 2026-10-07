'use client';

import React, { useState, useEffect } from 'react';
import { SettingsForm, OrgSettingsData } from './SettingsForm';
import { api } from '@/lib/api/client';
import { useDashboard, SelectOrgNotice } from '../DashboardContext';

export function DashboardSettingsContainer() {
  const { orgId } = useDashboard();
  const [loaded, setLoaded] = useState<{ orgId: string; data: OrgSettingsData } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!orgId) return;
    api.organizations.get(orgId)
      .then(org => setLoaded({ orgId, data: { shadowBanThreshold: org.shadowBanThreshold } }))
      .catch(() => setMessage({ ok: false, text: 'Erro ao carregar configurações.' }));
  }, [orgId]);

  const handleSave = async (newData: OrgSettingsData) => {
    if (!orgId) return;
    setIsSaving(true);
    setMessage(null);
    try {
      const org = await api.organizations.update(orgId, { shadowBanThreshold: newData.shadowBanThreshold });
      setLoaded({ orgId, data: { shadowBanThreshold: org.shadowBanThreshold } });
      setMessage({ ok: true, text: 'Configurações salvas com sucesso!' });
    } catch {
      setMessage({ ok: false, text: 'Não foi possível salvar as configurações.' });
    } finally {
      setIsSaving(false);
    }
  };

  if (!orgId) return <SelectOrgNotice />;

  const data = loaded?.orgId === orgId ? loaded.data : null;

  const feedback = message && (
    <p className={`mb-4 text-sm ${message.ok ? 'text-success' : 'text-danger'}`}>{message.text}</p>
  );

  if (!data) return feedback || <div className="p-8 text-center text-foreground/60 animate-pulse">Carregando configurações...</div>;

  return (
    <>
      {feedback}
      <SettingsForm 
        key={orgId}
        initialData={data} 
        onSave={handleSave} 
        isSaving={isSaving} 
      />
    </>
  );
}
