'use client';

import React, { useState, useEffect } from 'react';
import { OrphanDeviceList, OrphanDevice } from './OrphanDeviceList';
import { AssignDeviceForm, AssignDeviceData } from './AssignDeviceForm';
import { Drawer } from '@/components/ui/Drawer';
import { api } from '@/lib/api/client';
import type { Organization } from '@/lib/api/types';

export function GlobalDevicesContainer() {
  const [devices, setDevices] = useState<OrphanDevice[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [assignError, setAssignError] = useState('');

  useEffect(() => {
    Promise.all([api.devices.listPending(), api.organizations.list()])
      .then(([pending, orgs]) => {
        setDevices(pending.map(d => ({ id: d.id, identifier: d.id, firstSeen: d.connectedAt })));
        setOrganizations(orgs);
        setError('');
      })
      .catch(() => setError('Erro ao carregar dispositivos.'))
      .finally(() => setIsLoading(false));
  }, []);

  const handleAssign = async (data: AssignDeviceData) => {
    if (!assigningId) return;
    setIsSaving(true);
    setAssignError('');
    try {
      await api.devices.approve(assigningId, data);
      setDevices(prev => prev.filter(d => d.id !== assigningId));
      setAssigningId(null);
    } catch {
      setAssignError('Não foi possível atribuir o dispositivo.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className="p-8 text-center text-foreground/60 animate-pulse">Carregando dispositivos...</div>;

  return (
    <>
      {error && <p className="mb-4 text-sm text-danger">{error}</p>}
      <OrphanDeviceList 
        devices={devices}
        onAssignToOrg={(id) => { setAssignError(''); setAssigningId(id); }}
      />

      <Drawer
        isOpen={assigningId !== null}
        onClose={() => !isSaving && setAssigningId(null)}
        title="Atribuir dispositivo"
      >
        <AssignDeviceForm
          key={assigningId}
          organizations={organizations}
          isSaving={isSaving}
          error={assignError}
          onSubmit={handleAssign}
          onCancel={() => setAssigningId(null)}
        />
      </Drawer>
    </>
  );
}
