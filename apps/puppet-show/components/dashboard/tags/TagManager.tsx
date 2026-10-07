import React from 'react';
import { MdLabel, MdArrowUpward, MdDelete, MdCheckCircle } from 'react-icons/md';

export interface UserTag {
  id: string;
  name: string;
  usageCount?: number;
  status: 'pending' | 'promoted' | 'rejected';
}

interface TagManagerProps {
  tags: UserTag[];
  onPromoteTag: (tagId: string) => void;
  onRejectTag: (tagId: string) => void;
}

export function TagManager({ tags, onPromoteTag, onRejectTag }: TagManagerProps) {
  const pendingTags = tags.filter(t => t.status === 'pending');
  const promotedTags = tags.filter(t => t.status === 'promoted');

  return (
    <div className="space-y-8">
      {/* Pending Tags Section */}
      <section>
        <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
          <MdLabel className="w-5 h-5" /> Tags Sugeridas ({pendingTags.length})
        </h3>
        {pendingTags.length === 0 ? (
          <div className="p-6 bg-gray-50 border border-dashed rounded-lg text-center text-gray-500">
            Nenhuma nova tag aguardando revisão.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {pendingTags.map(tag => (
              <div key={tag.id} className="flex items-center justify-between p-4 bg-white border rounded-lg shadow-sm">
                <div>
                  <span className="inline-flex items-center rounded-md bg-blue-50 px-2.5 py-1 text-sm font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                    #{tag.name}
                  </span>
                  {tag.usageCount !== undefined && (
                    <div className="mt-1 text-xs text-gray-500">Usada {tag.usageCount} vezes</div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onPromoteTag(tag.id)}
                    className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                    title="Promover"
                  >
                    <MdArrowUpward className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => onRejectTag(tag.id)}
                    className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                    title="Rejeitar"
                  >
                    <MdDelete className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Promoted Tags Section */}
      <section>
        <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
          <MdCheckCircle className="w-5 h-5 text-green-600" /> Tags Promovidas ({promotedTags.length})
        </h3>
        <div className="flex flex-wrap gap-2 p-6 bg-gray-50 rounded-lg border">
          {promotedTags.length === 0 ? (
            <span className="text-gray-500 text-sm">Nenhuma tag promovida ainda.</span>
          ) : (
            promotedTags.map(tag => (
              <span key={tag.id} className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
                #{tag.name}
                {tag.usageCount !== undefined && (
                  <span className="bg-green-200 text-green-800 rounded-full px-1.5 py-0.5 text-xs">
                    {tag.usageCount}
                  </span>
                )}
              </span>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
