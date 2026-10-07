"use client";

import { useEvents } from "@/hooks/useEvents";
import { HomeContent } from "../HomeContent";

type HomeContainerProps = {
  qrSvg: string;
};

const REFRESH_INTERVAL = 15000;

export function HomeContainer({ qrSvg }: HomeContainerProps) {
  const { events, loaded, error, pendingId, toggleLike, toggleSubscription } = useEvents({
    refreshInterval: REFRESH_INTERVAL,
  });

  return (
    <HomeContent
      qrSvg={qrSvg}
      events={events}
      loaded={loaded}
      error={error}
      pendingId={pendingId}
      onToggleLike={toggleLike}
      onToggleSubscription={toggleSubscription}
    />
  );
}
