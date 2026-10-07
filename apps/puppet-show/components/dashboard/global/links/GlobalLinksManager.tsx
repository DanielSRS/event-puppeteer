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
      <form onSubmit={handleCreate} className="flex gap-4 bg-white p-4 rounded-lg shadow-sm border border-gray-200 items-end">
        <div className="flex-1">
          <label htmlFor="new-link-label" className="block text-sm font-medium text-gray-700 mb-1">Rótulo do Link</label>
          <input
            id="new-link-label"
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
            placeholder="Ex: Inscrição, Instagram, YouTube..."
          />
        </div>
        <button
          type="submit"
          disabled={!newLabel.trim()}
          className="inline-flex items-center gap-1 px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 h-[38px]"
        >
          <MdAdd className="w-5 h-5" /> Adicionar
        </button>
      </form>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <ul className="divide-y divide-gray-200">
          {links.map((link) => (
            <li key={link.id} className="flex items-center justify-between p-4 hover:bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded text-gray-600">
                  <MdLink className="w-5 h-5" />
                </div>
                <span className="font-medium text-gray-900">{link.label}</span>
              </div>
              {onDeleteLink && <button
                onClick={() => onDeleteLink(link.id)}
                className="p-2 text-gray-400 hover:text-red-600 rounded-full hover:bg-red-50"
                title="Remover Rótulo"
              >
                <MdDelete className="w-5 h-5" />
              </button>}
            </li>
          ))}
          {links.length === 0 && (
            <li className="p-8 text-center text-gray-500 text-sm">
              Nenhum rótulo de link cadastrado.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
