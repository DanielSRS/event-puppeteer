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
const inputClass = "input mt-1";

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
        <label htmlFor="org-name" className="block text-sm font-medium text-foreground">Nome</label>
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
        <label htmlFor="org-slug" className="block text-sm font-medium text-foreground">Identificador (slug)</label>
        <input
          id="org-slug"
          value={data.slug}
          onChange={(e) => { setSlugTouched(true); update('slug', ToSlug(e.target.value)); }}
          className={`${inputClass} font-mono`}
        />
        <p className="mt-1 text-xs text-foreground/60">Usado no endereço da organização. Apenas letras minúsculas, números e hífens.</p>
      </div>

      <div>
        <label htmlFor="org-url" className="block text-sm font-medium text-foreground">Domínio / URL</label>
        <input
          id="org-url"
          value={data.url}
          onChange={(e) => update('url', e.target.value)}
          placeholder="uefs.puppet-show.com"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="org-logo" className="block text-sm font-medium text-foreground">URL do logo</label>
        <input
          id="org-logo"
          value={data.logo}
          onChange={(e) => update('logo', e.target.value)}
          placeholder="https://..."
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="org-color" className="block text-sm font-medium text-foreground">Cor principal</label>
        <div className="mt-1 flex items-center gap-3">
          <input
            id="org-color"
            type="color"
            value={data.colorScheme}
            onChange={(e) => update('colorScheme', e.target.value)}
            className="h-9 w-14 rounded border border-muted"
          />
          <span className="font-mono text-sm text-foreground/70">{data.colorScheme}</span>
        </div>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-md text-sm font-medium text-foreground hover:bg-white/10">
          Cancelar
        </button>
        <button
          type="submit"
          disabled={!isValid || isSaving}
          className="px-4 py-2 bg-main text-background rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {isSaving ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Criar organização'}
        </button>
      </div>
    </form>
  );
}
