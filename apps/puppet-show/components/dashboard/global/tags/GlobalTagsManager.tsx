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
      <form onSubmit={handleCreate} className="flex gap-2 bg-surface p-4 rounded-lg shadow-sm border border-muted">
        <div className="flex-1">
          <label htmlFor="new-tag" className="sr-only">Nova Tag</label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <MdLabel className="h-5 w-5 text-foreground/50" />
            </div>
            <input
              type="text"
              id="new-tag"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              className="input pl-10"
              placeholder="Digite o nome da nova tag global"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={!newTagName.trim()}
          className="inline-flex items-center gap-1 px-4 py-2 bg-main text-background font-medium rounded-md hover:opacity-90 disabled:opacity-50"
        >
          <MdAdd className="w-5 h-5" /> Adicionar
        </button>
      </form>

      <div className="bg-surface rounded-lg shadow-sm border border-muted overflow-hidden">
        <ul className="divide-y divide-muted">
          {tags.map((tag) => (
            <li key={tag.id} className="flex items-center justify-between p-4 hover:bg-white/5">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center rounded-md bg-main/10 px-2.5 py-1 text-sm font-medium text-main ring-1 ring-inset ring-main/30">
                  #{tag.name}
                </span>
                {tag.usageGlobal !== undefined && (
                  <span className="text-xs text-foreground/60">
                    Usada em {tag.usageGlobal} eventos globalmente
                  </span>
                )}
              </div>
              {onDeleteTag && <button
                onClick={() => onDeleteTag(tag.id)}
                className="p-2 text-foreground/50 hover:text-danger rounded-full hover:bg-danger/20"
                title="Remover Tag Global"
              >
                <MdDelete className="w-5 h-5" />
              </button>}
            </li>
          ))}
          {tags.length === 0 && (
            <li className="p-8 text-center text-foreground/60 text-sm">
              Nenhuma tag global cadastrada.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
