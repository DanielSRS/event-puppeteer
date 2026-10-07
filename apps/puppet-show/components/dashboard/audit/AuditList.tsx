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
      <div className="flex flex-col items-center justify-center p-8 text-center bg-background rounded-lg border border-dashed border-muted">
        <MdHistory className="w-12 h-12 text-foreground/50 mb-4" />
        <h3 className="text-lg font-medium text-foreground">Nenhum registro de auditoria</h3>
        <p className="mt-1 text-sm text-foreground/60">
          Ainda não há ações moderativas ou administrativas registradas.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden bg-surface shadow-sm ring-1 ring-muted sm:rounded-lg">
      <table className="min-w-full divide-y divide-muted">
        <thead className="bg-background">
          <tr>
            <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-foreground sm:pl-6">
              Ação
            </th>
            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">
              Autor
            </th>
            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">
              Data e Hora
            </th>
            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">
              Detalhes
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-muted bg-surface">
          {logs.map((log) => (
            <tr key={log.id}>
              <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-foreground sm:pl-6">
                {log.action}
              </td>
              <td className="whitespace-nowrap px-3 py-4 text-sm text-foreground/60">
                <div className="flex items-center gap-2">
                  <MdPerson className="w-4 h-4 text-foreground/50" />
                  <div>
                    <div className="font-medium text-foreground">{log.actorName}</div>
                    <div className="text-xs">{log.actorEmail}</div>
                  </div>
                </div>
              </td>
              <td className="whitespace-nowrap px-3 py-4 text-sm text-foreground/60">
                {new Date(log.timestamp).toLocaleString()}
              </td>
              <td className="px-3 py-4 text-sm text-foreground/60 max-w-xs truncate">
                {log.details || '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
