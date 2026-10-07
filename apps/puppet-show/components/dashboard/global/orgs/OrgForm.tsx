import React, { useState } from 'react';

export interface OrgFormData {
  name: string;
  slug: string;
  url: string;
  logo: string;
  colorScheme: string;
}

interface OrgFormProps {
  initialData?: Partial<OrgFormData>;
  isSaving: boolean;
  error?: string;
  onSubmit: (data: OrgFormData) => void;
  onCancel: () => void;
}

const EMPTY: OrgFormData = { name: '', slug: '', url: '', logo: '', colorScheme: '#2563eb' };
const inputClass = "mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 sm:text-sm focus:border-blue-500 focus:ring-blue-500";

/* "Universidade Estadual" -> "universidade-estadual" */
function ToSlug(text: string) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function OrgForm({ initialData, isSaving, error, onSubmit, onCancel }: OrgFormProps) {
  const isEditing = Boolean(initialData?.slug);
  const [data, setData] = useState<OrgFormData>({ ...EMPTY, ...initialData });
  const [slugTouched, setSlugTouched] = useState(isEditing);
  const isValid = data.name.trim().length >= 2 && /^[a-z0-9-]+$/.test(data.slug);

  const update = (field: keyof OrgFormData, value: string) => setData(prev => ({ ...prev, [field]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isValid) onSubmit({ ...data, name: data.name.trim(), url: data.url.trim(), logo: data.logo.trim() });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="org-name" className="block text-sm font-medium text-gray-700">Nome</label>
        <input
          id="org-name"
          value={data.name}
          onChange={(e) => {
            update('name', e.target.value);
            if (!slugTouched) update('slug', ToSlug(e.target.value));
          }}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="org-slug" className="block text-sm font-medium text-gray-700">Identificador (slug)</label>
        <input
          id="org-slug"
          value={data.slug}
          onChange={(e) => { setSlugTouched(true); update('slug', ToSlug(e.target.value)); }}
          className={`${inputClass} font-mono`}
        />
        <p className="mt-1 text-xs text-gray-500">Usado no endereço da organização. Apenas letras minúsculas, números e hífens.</p>
      </div>

      <div>
        <label htmlFor="org-url" className="block text-sm font-medium text-gray-700">Domínio / URL</label>
        <input
          id="org-url"
          value={data.url}
          onChange={(e) => update('url', e.target.value)}
          placeholder="uefs.puppet-show.com"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="org-logo" className="block text-sm font-medium text-gray-700">URL do logo</label>
        <input
          id="org-logo"
          value={data.logo}
          onChange={(e) => update('logo', e.target.value)}
          placeholder="https://..."
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="org-color" className="block text-sm font-medium text-gray-700">Cor principal</label>
        <div className="mt-1 flex items-center gap-3">
          <input
            id="org-color"
            type="color"
            value={data.colorScheme}
            onChange={(e) => update('colorScheme', e.target.value)}
            className="h-9 w-14 rounded border border-gray-300"
          />
          <span className="font-mono text-sm text-gray-600">{data.colorScheme}</span>
        </div>
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
          {isSaving ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Criar organização'}
        </button>
      </div>
    </form>
  );
}
