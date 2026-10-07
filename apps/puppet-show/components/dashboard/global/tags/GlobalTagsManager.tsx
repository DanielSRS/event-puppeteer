import React, { useState } from 'react';
import { MdLabel, MdAdd, MdDelete } from 'react-icons/md';

export interface GlobalTag {
  id: string;
  name: string;
  usageGlobal?: number;
}

interface GlobalTagsManagerProps {
  tags: GlobalTag[];
  onCreateTag: (name: string) => void;
  /* OMITTED WHILE THE API CAN'T DELETE TAGS */
  onDeleteTag?: (id: string) => void;
}

export function GlobalTagsManager({ tags, onCreateTag, onDeleteTag }: GlobalTagsManagerProps) {
  const [newTagName, setNewTagName] = useState('');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTagName.trim()) {
      onCreateTag(newTagName.trim());
      setNewTagName('');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <form onSubmit={handleCreate} className="flex gap-2 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex-1">
          <label htmlFor="new-tag" className="sr-only">Nova Tag</label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <MdLabel className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              id="new-tag"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              className="block w-full rounded-md border-0 py-2 pl-10 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
              placeholder="Digite o nome da nova tag global"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={!newTagName.trim()}
          className="inline-flex items-center gap-1 px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          <MdAdd className="w-5 h-5" /> Adicionar
        </button>
      </form>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <ul className="divide-y divide-gray-200">
          {tags.map((tag) => (
            <li key={tag.id} className="flex items-center justify-between p-4 hover:bg-gray-50">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center rounded-md bg-blue-50 px-2.5 py-1 text-sm font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                  #{tag.name}
                </span>
                {tag.usageGlobal !== undefined && (
                  <span className="text-xs text-gray-500">
                    Usada em {tag.usageGlobal} eventos globalmente
                  </span>
                )}
              </div>
              {onDeleteTag && <button
                onClick={() => onDeleteTag(tag.id)}
                className="p-2 text-gray-400 hover:text-red-600 rounded-full hover:bg-red-50"
                title="Remover Tag Global"
              >
                <MdDelete className="w-5 h-5" />
              </button>}
            </li>
          ))}
          {tags.length === 0 && (
            <li className="p-8 text-center text-gray-500 text-sm">
              Nenhuma tag global cadastrada.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
