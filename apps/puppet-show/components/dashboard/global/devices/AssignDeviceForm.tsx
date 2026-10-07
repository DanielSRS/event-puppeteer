import React, { useState } from 'react';

export interface AssignDeviceData {
  organizationId: string;
  name: string;
  location: string;
}

interface AssignDeviceFormProps {
  organizations: Array<{ id: string; name: string }>;
  isSaving: boolean;
  error?: string;
  onSubmit: (data: AssignDeviceData) => void;
  onCancel: () => void;
}

const inputClass = "mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 sm:text-sm focus:border-blue-500 focus:ring-blue-500";

export function AssignDeviceForm({ organizations, isSaving, error, onSubmit, onCancel }: AssignDeviceFormProps) {
  const [data, setData] = useState<AssignDeviceData>({ organizationId: '', name: '', location: '' });
  const isValid = data.organizationId && data.name.trim() && data.location.trim();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isValid) onSubmit({ ...data, name: data.name.trim(), location: data.location.trim() });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="assign-org" className="block text-sm font-medium text-gray-700">Organização</label>
        <select
          id="assign-org"
          value={data.organizationId}
          onChange={(e) => setData({ ...data, organizationId: e.target.value })}
          className={inputClass}
        >
          <option value="">Selecione...</option>
          {organizations.map(org => (
            <option key={org.id} value={org.id}>{org.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="assign-name" className="block text-sm font-medium text-gray-700">Nome do dispositivo</label>
        <input
          id="assign-name"
          value={data.name}
          onChange={(e) => setData({ ...data, name: e.target.value })}
          placeholder="Ex: Kiosk MT-01"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="assign-location" className="block text-sm font-medium text-gray-700">Localização</label>
        <input
          id="assign-location"
          value={data.location}
          onChange={(e) => setData({ ...data, location: e.target.value })}
          placeholder="Ex: Módulo 1 - Térreo"
          className={inputClass}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100">
          Cancelar
        </button>
        <button
          type="submit"
          disabled={!isValid || isSaving}
          className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {isSaving ? 'Atribuindo...' : 'Atribuir e aprovar'}
        </button>
      </div>
    </form>
  );
}
