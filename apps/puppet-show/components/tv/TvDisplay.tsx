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
      <div className="min-h-screen bg-background flex items-center justify-center text-foreground text-3xl">
        Nenhum evento ativo no momento.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex overflow-hidden">
      {/* Left Panel: Auto-scrolling Events List */}
      <div className="flex-1 p-8 overflow-hidden relative">
        <h1 className="text-4xl font-bold text-foreground mb-8 border-b border-muted pb-4">
          Eventos em {orgName}
        </h1>
        
        {/* Simple CSS animation for scrolling could be applied here */}
        <div className="space-y-6">
          {events.map((event, idx) => (
            <div key={idx} className="bg-surface rounded-xl p-6 flex gap-6 items-center shadow-lg border border-muted">
              {event.imageUrl ? (
                <div 
                  className="w-48 h-32 rounded-lg bg-cover bg-center shrink-0" 
                  style={{ backgroundImage: `url(${event.imageUrl})` }} 
                />
              ) : (
                <div className="w-48 h-32 rounded-lg bg-main/15 shrink-0 flex items-center justify-center">
                  <span className="text-4xl">📅</span>
                </div>
              )}
              <div className="flex-1">
                <h2 className="text-3xl font-bold mb-2 text-main">{event.title}</h2>
                <div className="text-xl text-foreground mb-1">
                  {new Date(`${event.date}T00:00:00`).toLocaleDateString('pt-BR')} às {event.time}
                </div>
                <div className="text-lg text-foreground/50 flex items-center gap-2">
                  📍 {event.location}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right Panel: Fixed Info & QR Code */}
      <div className="w-96 bg-surface p-8 flex flex-col items-center justify-between border-l border-muted">
        <div className="text-center w-full">
          <div className="text-6xl font-light tracking-wider mb-2">
            {currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </div>
          <div className="text-lg text-foreground/60">
            {currentTime.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
        </div>

        <div className="flex flex-col items-center space-y-6">
          <div className="p-4 bg-background rounded-xl w-48 h-48 flex items-center justify-center border-4 border-dashed border-muted">
            <div className="text-foreground/50 text-sm text-center">QR Code<br/>{appUrl}</div>
          </div>
          <div className="text-center">
            <h3 className="text-xl font-bold mb-2 text-main">Acesse o Mural</h3>
            <p className="text-sm text-foreground/50 leading-relaxed">
              Escaneie o QR Code para ver detalhes, salvar eventos e se inscrever diretamente pelo seu celular.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
