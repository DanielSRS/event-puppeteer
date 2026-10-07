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
    <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
      {/* Banner */}
      {event.bannerUrl ? (
        <div className="h-64 w-full bg-cover bg-center" style={{ backgroundImage: `url(${event.bannerUrl})` }} />
      ) : (
        <div className="h-48 w-full bg-gradient-to-r from-blue-500 to-indigo-600" />
      )}

      <div className="p-8">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex flex-wrap gap-2 mb-3">
              {event.tags.map(tag => (
                <span key={tag} className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  #{tag}
                </span>
              ))}
            </div>
            <h1 className="text-3xl font-extrabold text-gray-900 mb-2">{event.title}</h1>
            {event.authorName && <p className="text-sm text-gray-500">Organizado por {event.authorName}</p>}
          </div>
          <div className="flex gap-2">
            <button onClick={() => onShare(event.id)} className="p-2 text-gray-500 hover:text-blue-600 rounded-full hover:bg-blue-50 transition-colors" title="Compartilhar">
              <MdShare className="w-6 h-6" />
            </button>
            <button onClick={() => onReport(event.id)} className="p-2 text-gray-500 hover:text-red-600 rounded-full hover:bg-red-50 transition-colors" title="Denunciar">
              <MdFlag className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="mt-8 prose prose-blue max-w-none">
          <p className="text-gray-700 whitespace-pre-line">{event.description}</p>
        </div>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Schedule */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <MdCalendarToday className="text-blue-600" /> Programação
            </h3>
            <ul className="space-y-4">
              {event.schedule.map((slot, index) => (
                <li key={index} className="flex gap-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <div className="flex-shrink-0 text-center">
                    <div className="text-sm font-bold text-blue-700">{new Date(`${slot.date}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</div>
                    <div className="text-xs text-gray-500">{slot.startTime}</div>
                  </div>
                  <div>
                    {slot.activity && <div className="font-medium text-gray-900">{slot.activity}</div>}
                    {slot.endTime && <div className="text-sm text-gray-500">Até {slot.endTime}</div>}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Location & Links */}
          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <MdLocationOn className="text-red-500" /> Localização
              </h3>
              <p className="text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-100">{event.location}</p>
              {event.mapUrl && (
                <div className="mt-3 aspect-video w-full rounded-lg bg-gray-200 overflow-hidden relative">
                  {/* Simplified map placeholder */}
                  <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                    [Mapa Interativo: {event.mapUrl}]
                  </div>
                </div>
              )}
            </div>

            {event.links.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <MdLink className="text-gray-500" /> Links Úteis
                </h3>
                <div className="flex flex-col gap-2">
                  {event.links.map(link => (
                    <a
                      key={link.id}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors text-blue-700 font-medium text-sm"
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
