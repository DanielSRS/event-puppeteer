import React from 'react';
import { MdReport, MdVisibilityOff, MdVisibility, MdCheckCircle } from 'react-icons/md';

export interface Report {
  id: string;
  eventId: string;
  eventTitle: string;
  reason: string;
  comment?: string;
  reportedBy?: string;
  reportedAt: string;
  status: 'pending' | 'resolved';
  eventIsHidden: boolean;
}

interface ReportListProps {
  reports: Report[];
  onToggleVisibility: (eventId: string, currentHiddenStatus: boolean) => void;
  onResolveReport: (reportId: string) => void;
}

export function ReportList({ reports, onToggleVisibility, onResolveReport }: ReportListProps) {
  if (reports.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center bg-background rounded-lg border border-dashed border-muted">
        <MdReport className="w-12 h-12 text-foreground/50 mb-4" />
        <h3 className="text-lg font-medium text-foreground">Nenhuma denúncia pendente</h3>
        <p className="mt-1 text-sm text-foreground/60">
          Não há denúncias aguardando moderação no momento.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {reports.map((report) => (
        <div key={report.id} className="bg-surface border rounded-lg overflow-hidden shadow-sm border-muted">
          <div className="p-4 border-b flex justify-between items-start bg-background border-muted">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex items-center rounded-md bg-danger/10 px-2 py-1 text-xs font-medium text-danger ring-1 ring-inset ring-danger/30">
                  {report.reason}
                </span>
                <span className="text-xs text-foreground/60">
                  {new Date(report.reportedAt).toLocaleDateString()}
                </span>
              </div>
              <h4 className="text-md font-semibold text-foreground">{report.eventTitle}</h4>
              <p className="text-sm text-foreground/70 mt-2">{report.comment || "Sem comentários adicionais."}</p>
              {report.reportedBy && (
                <p className="text-xs text-foreground/60 mt-1">Reportado por: {report.reportedBy}</p>
              )}
            </div>
            
            <div className="flex items-center gap-2">
               {report.status === 'pending' && (
                  <button
                    onClick={() => onResolveReport(report.id)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-success bg-success/10 rounded-md hover:bg-success/20 border border-success/40"
                  >
                    <MdCheckCircle className="w-4 h-4" />
                    Resolver
                  </button>
               )}
            </div>
          </div>
          <div className="p-4 flex items-center justify-between bg-surface">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium text-foreground">Status do Evento:</span>
              {report.eventIsHidden ? (
                <span className="inline-flex items-center gap-1 text-danger">
                  <MdVisibilityOff className="w-4 h-4" /> Oculto (Shadow Banned)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-success">
                  <MdVisibility className="w-4 h-4" /> Visível Público
                </span>
              )}
            </div>
            <button
              onClick={() => onToggleVisibility(report.eventId, report.eventIsHidden)}
              className="px-3 py-1.5 text-sm font-medium text-foreground bg-surface border border-muted rounded-md hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-main"
            >
              {report.eventIsHidden ? 'Restaurar Visibilidade' : 'Ocultar Evento'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
