import React, { useEffect, useState } from 'react';

export interface TvEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  imageUrl?: string;
}

interface TvDisplayProps {
  events: TvEvent[];
  appUrl: string;
  orgName: string;
}

export function TvDisplay({ events, appUrl, orgName }: TvDisplayProps) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (events.length === 0) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white text-3xl">
        Nenhum evento ativo no momento.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex overflow-hidden">
      {/* Left Panel: Auto-scrolling Events List */}
      <div className="flex-1 p-8 overflow-hidden relative">
        <h1 className="text-4xl font-bold text-gray-100 mb-8 border-b border-gray-700 pb-4">
          Eventos em {orgName}
        </h1>
        
        {/* Simple CSS animation for scrolling could be applied here */}
        <div className="space-y-6">
          {events.map((event, idx) => (
            <div key={idx} className="bg-gray-800 rounded-xl p-6 flex gap-6 items-center shadow-lg border border-gray-700">
              {event.imageUrl ? (
                <div 
                  className="w-48 h-32 rounded-lg bg-cover bg-center shrink-0" 
                  style={{ backgroundImage: `url(${event.imageUrl})` }} 
                />
              ) : (
                <div className="w-48 h-32 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 shrink-0 flex items-center justify-center">
                  <span className="text-4xl">📅</span>
                </div>
              )}
              <div className="flex-1">
                <h2 className="text-3xl font-bold mb-2 text-blue-400">{event.title}</h2>
                <div className="text-xl text-gray-300 mb-1">
                  {new Date(`${event.date}T00:00:00`).toLocaleDateString('pt-BR')} às {event.time}
                </div>
                <div className="text-lg text-gray-400 flex items-center gap-2">
                  📍 {event.location}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right Panel: Fixed Info & QR Code */}
      <div className="w-96 bg-gray-950 p-8 flex flex-col items-center justify-between border-l border-gray-800">
        <div className="text-center w-full">
          <div className="text-6xl font-light tracking-wider mb-2">
            {currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </div>
          <div className="text-lg text-gray-500">
            {currentTime.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
        </div>

        <div className="flex flex-col items-center space-y-6">
          <div className="p-4 bg-white rounded-xl w-48 h-48 flex items-center justify-center border-4 border-dashed border-gray-300">
            <div className="text-gray-400 text-sm text-center">QR Code<br/>{appUrl}</div>
          </div>
          <div className="text-center">
            <h3 className="text-xl font-bold mb-2 text-blue-400">Acesse o Mural</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              Escaneie o QR Code para ver detalhes, salvar eventos e se inscrever diretamente pelo seu celular.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
