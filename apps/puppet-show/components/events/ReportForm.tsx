import React, { useState } from 'react';
import type { Report } from '@/lib/api/types';

export type ReportReason = Report['reason'];

export interface ReportFormData {
  reason: ReportReason;
  comment?: string;
}

interface ReportFormProps {
  isSending: boolean;
  error?: string;
  onSubmit: (data: ReportFormData) => void;
  onCancel: () => void;
}

const REASONS: Array<{ value: ReportReason; label: string }> = [
  { value: 'spam', label: 'Spam' },
  { value: 'offensive_content', label: 'Conteúdo ofensivo' },
  { value: 'incorrect_information', label: 'Informação incorreta' },
  { value: 'duplicate', label: 'Evento duplicado' },
];

export function ReportForm({ isSending, error, onSubmit, onCancel }: ReportFormProps) {
  const [reason, setReason] = useState<ReportReason | ''>('');
  const [comment, setComment] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (reason) onSubmit({ reason, ...(comment.trim() ? { comment: comment.trim() } : {}) });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <fieldset>
        <legend className="text-sm font-medium text-gray-700 mb-2">Motivo da denúncia</legend>
        <div className="space-y-2">
          {REASONS.map(option => (
            <label key={option.value} className="flex items-center gap-2 text-sm text-gray-800 cursor-pointer">
              <input
                type="radio"
                name="reason"
                value={option.value}
                checked={reason === option.value}
                onChange={() => setReason(option.value)}
                className="h-4 w-4 text-red-600"
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="report-comment" className="block text-sm font-medium text-gray-700">Comentário (opcional)</label>
        <textarea
          id="report-comment"
          rows={3}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 sm:text-sm"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100">
          Cancelar
        </button>
        <button
          type="submit"
          disabled={!reason || isSending}
          className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50"
        >
          {isSending ? 'Enviando...' : 'Enviar denúncia'}
        </button>
      </div>
    </form>
  );
}
