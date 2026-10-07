/* components/home/HomeContent.tsx */

"use client";

import { EventList } from "@/components/events/EventList";
import { EventShowcase } from "@/components/events/EventShowcase";
import { QrCodePanel } from "@/components/qrcode/QrCodePanel";
import { useEvents } from "@/hooks/useEvents";

type HomeContentProps = {
  qrSvg: string;
};

/* THE BIG SCREEN REFRESHES BY ITSELF, SO THE ORDER FOLLOWS THE LIKES IN REAL TIME */
const REFRESH_INTERVAL = 15000;

export function HomeContent({ qrSvg }: HomeContentProps) {
  const { events, loaded, error, pendingId, toggleLike, toggleSubscription } = useEvents({
    refreshInterval: REFRESH_INTERVAL,
  });

  return (
    <>
      {/* BIG SCREEN: THE LIST SCROLLS BY ITSELF AND THE QR CODE INVITES PEOPLE IN. */}
      {/* landscape: QR CODE ON THE SIDE. portrait: QR CODE AS A FOOTER */}
      <main className="hidden lg:flex flex-1 min-h-0 flex-col gap-4 p-6 max-w-7xl w-full mx-auto">
        <header className="column gap-1">
          <h1 className="title">
            Eventos em destaque
          </h1>
        </header>

        <div className="flex-1 min-h-0 flex gap-6 portrait:flex-col">
          <EventShowcase events={events} loaded={loaded} />

          <div className="hidden landscape:block">
            <QrCodePanel svg={qrSvg} />
          </div>

          <div className="hidden portrait:block">
            <QrCodePanel svg={qrSvg} variant="footer" />
          </div>
        </div>
      </main>

      {/* PHONE AND SMALL WINDOWS: THE LIST PEOPLE INTERACT WITH. */}
      <main className="lg:hidden flex flex-col gap-4 p-4 max-w-2xl w-full mx-auto">
        <header className="column gap-1">
          <h1 className="title">
            Mural de Eventos
          </h1>
        </header>

        <EventList
          events={events}
          loaded={loaded}
          error={error}
          pendingId={pendingId}
          onToggleLike={toggleLike}
          onToggleSubscription={toggleSubscription}
        />
      </main>
    </>
  );
};