import React from 'react';
import { MdCalendarToday, MdLocationOn, MdLink, MdShare, MdFlag } from 'react-icons/md';

export interface EventDetailData {
  id: string;
  title: string;
  description: string;
  authorName?: string;
  schedule: Array<{ date: string; startTime?: string; endTime?: string; activity?: string }>;
  location: string;
  mapUrl?: string;
  links: Array<{ id: string; label: string; url: string }>;
  tags: string[];
  bannerUrl?: string;
}

interface EventDetailsProps {
  event: EventDetailData;
  onReport: (eventId: string) => void;
  onShare: (eventId: string) => void;
}

export function EventDetails({ event, onReport, onShare }: EventDetailsProps) {
  return (
    <div className="max-w-4xl mx-auto bg-surface rounded-xl shadow-sm overflow-hidden border border-muted">
      {/* Banner */}
      {event.bannerUrl ? (
        <div className="h-64 w-full bg-cover bg-center" style={{ backgroundImage: `url(${event.bannerUrl})` }} />
      ) : (
        <div className="h-48 w-full bg-main/15" />
      )}

      <div className="p-8">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex flex-wrap gap-2 mb-3">
              {event.tags.map(tag => (
                <span key={tag} className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-main/10 text-main">
                  #{tag}
                </span>
              ))}
            </div>
            <h1 className="text-3xl font-extrabold text-foreground mb-2">{event.title}</h1>
            {event.authorName && <p className="text-sm text-foreground/60">Organizado por {event.authorName}</p>}
          </div>
          <div className="flex gap-2">
            <button onClick={() => onShare(event.id)} className="p-2 text-foreground/60 hover:text-main rounded-full hover:bg-main/20 transition-colors" title="Compartilhar">
              <MdShare className="w-6 h-6" />
            </button>
            <button onClick={() => onReport(event.id)} className="p-2 text-foreground/60 hover:text-danger rounded-full hover:bg-danger/20 transition-colors" title="Denunciar">
              <MdFlag className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="mt-8 prose prose-blue max-w-none">
          <p className="text-foreground whitespace-pre-line">{event.description}</p>
        </div>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Schedule */}
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <MdCalendarToday className="text-main" /> Programação
            </h3>
            <ul className="space-y-4">
              {event.schedule.map((slot, index) => (
                <li key={index} className="flex gap-4 p-3 bg-background rounded-lg border border-muted">
                  <div className="flex-shrink-0 text-center">
                    <div className="text-sm font-bold text-main">{new Date(`${slot.date}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</div>
                    <div className="text-xs text-foreground/60">{slot.startTime}</div>
                  </div>
                  <div>
                    {slot.activity && <div className="font-medium text-foreground">{slot.activity}</div>}
                    {slot.endTime && <div className="text-sm text-foreground/60">Até {slot.endTime}</div>}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Location & Links */}
          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <MdLocationOn className="text-danger" /> Localização
              </h3>
              <p className="text-foreground bg-background p-3 rounded-lg border border-muted">{event.location}</p>
              {event.mapUrl && (
                <div className="mt-3 aspect-video w-full rounded-lg bg-muted overflow-hidden relative">
                  {/* Simplified map placeholder */}
                  <div className="absolute inset-0 flex items-center justify-center text-foreground/60">
                    [Mapa Interativo: {event.mapUrl}]
                  </div>
                </div>
              )}
            </div>

            {event.links.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <MdLink className="text-foreground/60" /> Links Úteis
                </h3>
                <div className="flex flex-col gap-2">
                  {event.links.map(link => (
                    <a
                      key={link.id}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3 rounded-lg border border-muted hover:border-main/40 hover:bg-main/20 transition-colors text-main font-medium text-sm"
                    >
                      {link.label}
                      <MdLink className="w-4 h-4" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
