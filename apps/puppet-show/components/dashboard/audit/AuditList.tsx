import React from 'react';
import { MdHistory, MdPerson } from 'react-icons/md';

export interface AuditLog {
  id: string;
  action: string;
  actorName: string;
  actorEmail: string;
  targetId?: string;
  timestamp: string;
  details?: string;
}

interface AuditListProps {
  logs: AuditLog[];
}

export function AuditList({ logs }: AuditListProps) {
  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center bg-gray-50 rounded-lg border border-dashed border-gray-300">
        <MdHistory className="w-12 h-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900">Nenhum registro de auditoria</h3>
        <p className="mt-1 text-sm text-gray-500">
          Ainda não há ações moderativas ou administrativas registradas.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden bg-white shadow-sm ring-1 ring-black ring-opacity-5 sm:rounded-lg">
      <table className="min-w-full divide-y divide-gray-300">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
              Ação
            </th>
            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
              Autor
            </th>
            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
              Data e Hora
            </th>
            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
              Detalhes
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {logs.map((log) => (
            <tr key={log.id}>
              <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                {log.action}
              </td>
              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                <div className="flex items-center gap-2">
                  <MdPerson className="w-4 h-4 text-gray-400" />
                  <div>
                    <div className="font-medium text-gray-900">{log.actorName}</div>
                    <div className="text-xs">{log.actorEmail}</div>
                  </div>
                </div>
              </td>
              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                {new Date(log.timestamp).toLocaleString()}
              </td>
              <td className="px-3 py-4 text-sm text-gray-500 max-w-xs truncate">
                {log.details || '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
