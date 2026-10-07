import React, { useState } from 'react';
import { MdLink, MdAdd, MdDelete } from 'react-icons/md';

export interface GlobalLinkDef {
  id: string;
  label: string;
}

interface GlobalLinksManagerProps {
  links: GlobalLinkDef[];
  onCreateLink: (label: string) => void;
  /* OMITTED WHILE THE API CAN'T DELETE LABELS */
  onDeleteLink?: (id: string) => void;
}

export function GlobalLinksManager({ links, onCreateLink, onDeleteLink }: GlobalLinksManagerProps) {
  const [newLabel, setNewLabel] = useState('');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (newLabel.trim()) {
      onCreateLink(newLabel.trim());
      setNewLabel('');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <form onSubmit={handleCreate} className="flex gap-4 bg-surface p-4 rounded-lg shadow-sm border border-muted items-end">
        <div className="flex-1">
          <label htmlFor="new-link-label" className="block text-sm font-medium text-foreground mb-1">Rótulo do Link</label>
          <input
            id="new-link-label"
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            className="input"
            placeholder="Ex: Inscrição, Instagram, YouTube..."
          />
        </div>
        <button
          type="submit"
          disabled={!newLabel.trim()}
          className="inline-flex items-center gap-1 px-4 py-2 bg-main text-background font-medium rounded-md hover:opacity-90 disabled:opacity-50 h-[38px]"
        >
          <MdAdd className="w-5 h-5" /> Adicionar
        </button>
      </form>

      <div className="bg-surface rounded-lg shadow-sm border border-muted overflow-hidden">
        <ul className="divide-y divide-muted">
          {links.map((link) => (
            <li key={link.id} className="flex items-center justify-between p-4 hover:bg-white/5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted rounded text-foreground/70">
                  <MdLink className="w-5 h-5" />
                </div>
                <span className="font-medium text-foreground">{link.label}</span>
              </div>
              {onDeleteLink && <button
                onClick={() => onDeleteLink(link.id)}
                className="p-2 text-foreground/50 hover:text-danger rounded-full hover:bg-danger/20"
                title="Remover Rótulo"
              >
                <MdDelete className="w-5 h-5" />
              </button>}
            </li>
          ))}
          {links.length === 0 && (
            <li className="p-8 text-center text-foreground/60 text-sm">
              Nenhum rótulo de link cadastrado.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
