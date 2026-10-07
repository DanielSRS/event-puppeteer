'use client';

import React, { useState, useEffect } from 'react';
import { OrgManager, Tenant } from './OrgManager';
import { OrgForm, OrgFormData } from './OrgForm';
import { Drawer } from '@/components/ui/Drawer';
import { api } from '@/lib/api/client';
import type { Organization } from '@/lib/api/types';

const DEFAULT_COLOR = '#2563eb';

function ToTenant(org: Organization): Tenant {
  return {
    id: org.id,
    name: org.name,
    acronym: org.slug.slice(0, 4).toUpperCase(),
    domain: org.url ?? org.slug,
    primaryColor: org.colorScheme ?? DEFAULT_COLOR,
  };
}

// Empty optional fields are left out instead of being saved as ""
function ToInput(data: OrgFormData) {
  return {
    name: data.name,
    slug: data.slug,
    colorScheme: data.colorScheme,
    ...(data.url ? { url: data.url } : {}),
    ...(data.logo ? { logo: data.logo } : {}),
  };
}

export function GlobalOrgsContainer() {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  // undefined = drawer closed, null = creating, string = editing that org
  const [editingId, setEditingId] = useState<string | null | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    api.organizations.list()
      .then(data => { setOrgs(data); setError(''); })
      .catch(() => setError('Erro ao carregar organizações.'))
      .finally(() => setIsLoading(false));
  }, []);

  const editing = editingId ? orgs.find(o => o.id === editingId) : undefined;

  const openDrawer = (id: string | null) => {
    setFormError('');
    setEditingId(id);
  };

  const handleSubmit = async (data: OrgFormData) => {
    setIsSaving(true);
    setFormError('');
    try {
      if (editingId) {
        const updated = await api.organizations.update(editingId, ToInput(data));
        setOrgs(prev => prev.map(o => o.id === updated.id ? updated : o));
      } else {
        const created = await api.organizations.create(ToInput(data));
        setOrgs(prev => [...prev, created]);
      }
      setEditingId(undefined);
    } catch {
      setFormError('Não foi possível salvar a organização.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className="p-8 text-center text-gray-500 animate-pulse">Carregando tenants...</div>;

  return (
    <>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      <OrgManager 
        organizations={orgs.map(ToTenant)}
        onEditOrg={openDrawer}
        onCreateOrg={() => openDrawer(null)}
      />

      <Drawer
        isOpen={editingId !== undefined}
        onClose={() => !isSaving && setEditingId(undefined)}
        title={editing ? 'Editar organização' : 'Nova organização'}
      >
        <OrgForm
          key={editingId ?? 'new'}
          initialData={editing && {
            name: editing.name,
            slug: editing.slug,
            url: editing.url ?? '',
            logo: editing.logo ?? '',
            colorScheme: editing.colorScheme ?? DEFAULT_COLOR,
          }}
          isSaving={isSaving}
          error={formError}
          onSubmit={handleSubmit}
          onCancel={() => setEditingId(undefined)}
        />
      </Drawer>
    </>
  );
}
