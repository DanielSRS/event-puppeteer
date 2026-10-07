import React from "react";
import { MdEdit, MdDelete, MdVisibility, MdVisibilityOff } from "react-icons/md";
import type { EventItem } from "@/hooks/useEvents";
import { FromISODate } from "@/utils/date";

export type UserEventItem = EventItem & {
  status: "ACTIVE" | "HIDDEN" | "PAST";
};

export type UserEventListProps = {
  events: UserEventItem[];
  loading: boolean;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
};

export function UserEventList({ events, loading, onEdit, onDelete }: UserEventListProps) {
  if (loading) {
    return (
      <div className="card center py-12 opacity-60">
        <p>Carregando seus eventos...</p>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="card center py-12 opacity-60">
        <p>Você ainda não criou nenhum evento.</p>
      </div>
    );
  }

  return (
    <div className="column gap-4">
      {/* Desktop Table View */}
      <div className="hidden sm:block card overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="border-b border-muted text-xs uppercase opacity-80">
            <tr>
              <th className="px-4 py-3">Evento</th>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Interações</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id} className="border-b border-muted/50 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                <td className="px-4 py-3 font-semibold min-w-48">{event.title}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {FromISODate(event.date)} às {event.time}
                </td>
                <td className="px-4 py-3">
                  <EventStatusBadge status={event.status} />
                </td>
                <td className="px-4 py-3 opacity-80">
                  {event.likes} curtidas • {event.subscriptions} inscritos
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="row gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => onEdit(event.id)}
                      className="p-2 rounded hover:bg-black/10 dark:hover:bg-white/10 text-blue-600 dark:text-blue-400"
                      title="Editar evento"
                    >
                      <MdEdit className="icon" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(event.id)}
                      className="p-2 rounded hover:bg-black/10 dark:hover:bg-white/10 text-red-600 dark:text-red-400"
                      title="Excluir evento"
                    >
                      <MdDelete className="icon" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="sm:hidden column gap-4">
        {events.map((event) => (
          <div key={event.id} className="card column gap-3">
            <div className="between items-start gap-2">
              <h3 className="font-semibold text-base">{event.title}</h3>
              <EventStatusBadge status={event.status} />
            </div>
            <div className="text-sm opacity-80 column gap-1">
              <span>{FromISODate(event.date)} às {event.time}</span>
              <span>{event.likes} curtidas • {event.subscriptions} inscritos</span>
            </div>
            <div className="row gap-2 pt-2 border-t border-muted">
              <button
                type="button"
                onClick={() => onEdit(event.id)}
                className="button clean flex-1 text-blue-600 dark:text-blue-400"
              >
                <MdEdit className="icon" /> Editar
              </button>
              <button
                type="button"
                onClick={() => onDelete(event.id)}
                className="button clean flex-1 text-red-600 dark:text-red-400"
              >
                <MdDelete className="icon" /> Excluir
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EventStatusBadge({ status }: { status: UserEventItem["status"] }) {
  const styles = {
    ACTIVE: "bg-success/10 text-success border-success/20",
    HIDDEN: "bg-red-500/10 text-red-500 border-red-500/20",
    PAST: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20",
  };

  const labels = {
    ACTIVE: "Ativo",
    HIDDEN: "Oculto",
    PAST: "Passado",
  };

  const icons = {
    ACTIVE: <MdVisibility className="icon text-sm" />,
    HIDDEN: <MdVisibilityOff className="icon text-sm" />,
    PAST: <MdVisibility className="icon text-sm" />,
  };

  return (
    <span className={`row gap-1 w-fit px-2 py-1 rounded-full text-xs font-semibold border ${styles[status]}`}>
      {icons[status]}
      {labels[status]}
    </span>
  );
}
