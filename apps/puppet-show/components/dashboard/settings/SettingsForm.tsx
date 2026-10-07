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
    <form onSubmit={handleSubmit} className="space-y-6 bg-surface p-6 rounded-lg shadow-sm border border-muted">
      <div className="flex items-center gap-2 mb-6 border-b pb-4 border-muted">
        <MdSettings className="w-6 h-6 text-foreground/60" />
        <h2 className="text-lg font-medium text-foreground">Configurações Gerais da Organização</h2>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-foreground">Limite para Shadow Ban</label>
          <div className="mt-1 flex rounded-md shadow-sm">
            <input
              type="number"
              min="1"
              value={formData.shadowBanThreshold}
              onChange={(e) => setFormData({ ...formData, shadowBanThreshold: parseInt(e.target.value) || 0 })}
              className="input"
            />
          </div>
          <p className="mt-1 text-xs text-foreground/60">Número de denúncias necessárias para ocultar um evento automaticamente.</p>
        </div>
      </div>

      <div className="flex justify-end pt-2 border-t border-muted">
        <button
          type="submit"
          disabled={isSaving}
          className="inline-flex items-center gap-2 rounded-md bg-main px-4 py-2 text-sm font-semibold text-background shadow-sm hover:opacity-90 disabled:opacity-50"
        >
          <MdSave className="w-4 h-4" />
          {isSaving ? 'Salvando...' : 'Salvar Alterações'}
        </button>
      </div>
    </form>
  );
}
