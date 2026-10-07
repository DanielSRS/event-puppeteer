import React from 'react';
import { MdSave, MdSettings } from 'react-icons/md';

export interface OrgSettingsData {
  shadowBanThreshold: number;
}

interface SettingsFormProps {
  initialData: OrgSettingsData;
  onSave: (data: OrgSettingsData) => void;
  isSaving: boolean;
}

export function SettingsForm({ initialData, onSave, isSaving }: SettingsFormProps) {
  const [formData, setFormData] = React.useState<OrgSettingsData>(initialData);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <div className="flex items-center gap-2 mb-6 border-b pb-4">
        <MdSettings className="w-6 h-6 text-gray-500" />
        <h2 className="text-lg font-medium text-gray-900">Configurações Gerais da Organização</h2>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700">Limite para Shadow Ban</label>
          <div className="mt-1 flex rounded-md shadow-sm">
            <input
              type="number"
              min="1"
              value={formData.shadowBanThreshold}
              onChange={(e) => setFormData({ ...formData, shadowBanThreshold: parseInt(e.target.value) || 0 })}
              className="block w-full rounded-md border-gray-300 focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
            />
          </div>
          <p className="mt-1 text-xs text-gray-500">Número de denúncias necessárias para ocultar um evento automaticamente.</p>
        </div>
      </div>

      <div className="flex justify-end pt-2 border-t border-gray-100">
        <button
          type="submit"
          disabled={isSaving}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50"
        >
          <MdSave className="w-4 h-4" />
          {isSaving ? 'Salvando...' : 'Salvar Alterações'}
        </button>
      </div>
    </form>
  );
}
