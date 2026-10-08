/**
 * Connects the home page to the API through {@link useEvents}.
 *
 * @module
 */

"use client";

import type { SiteQr } from "@/components/qrcode/siteQrCode";
import { useEvents } from "@/hooks/useEvents";
import { TodayInBrazil } from "@/utils/date";
import { HomeContent } from "../HomeContent";

export type HomeContainerProps = {
  /** QR code built on the server (see `app/page.tsx`). */
  qr: SiteQr;
};

/** The live feed for the home page. */
export function HomeContainer({ qr }: HomeContainerProps) {
  const feed = useEvents();

  return (
    <HomeContent
      qr={qr}
      status={feed.status}
      cards={feed.cards}
      today={TodayInBrazil()}
      updatedAt={feed.updatedAt}
      errors={[feed.refreshError, feed.tagsError, feed.likeError]}
      loginPromptFor={feed.loginPromptFor}
      isLikeInFlight={feed.isLikeInFlight}
      onToggleLike={(id) => void feed.toggleLike(id)}
      onDelete={feed.deleteEvent}
    />
  );
}
