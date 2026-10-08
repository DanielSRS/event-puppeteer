/**
 * Feeds the TV display from the API: the public organization's branding and
 * feed, refreshed every {@link TV_REFRESH_MS}.
 *
 * @module
 */

"use client";

import { useEffect, useState } from "react";
import type { SiteQr } from "@/components/qrcode/siteQrCode";
import { ErrorAlert } from "@/components/ui/Feedback";
import { api, ApiErrorMessage } from "@/lib/api/client";
import { MISSING_ORG_MESSAGE, PUBLIC_ORG_ID } from "@/lib/api/session";
import { ToTvEvent, type TvEvent } from "@/lib/api/mappers";
import { TV_REFRESH_MS } from "@/domain/tv";
import { TodayInBrazil } from "@/utils/date";
import { TvDisplay, type TvBranding } from "./TvDisplay";

export type TvDisplayContainerProps = {
  /** QR code built on the server (see `app/display/page.tsx`). */
  qr: SiteQr;
};

/**
 * Loads the branding once and the feed on a timer. A failed refresh keeps the
 * last list on screen and shows the error until a refresh works again.
 */
export function TvDisplayContainer({ qr }: TvDisplayContainerProps) {
  const [branding, setBranding] = useState<TvBranding | null>(null);
  const [brandingError, setBrandingError] = useState<string | null>(null);
  const [events, setEvents] = useState<TvEvent[] | null>(null);
  const [feedError, setFeedError] = useState<string | null>(null);

  useEffect(() => {
    if (PUBLIC_ORG_ID === null) return;
    const orgId = PUBLIC_ORG_ID;
    let active = true;

    api.organizations.get(orgId).then((org) => {
      if (!active) return;
      if (org.ok) setBranding({ name: org.value.name, logo: org.value.logo === undefined || org.value.logo === "" ? null : org.value.logo });
      else setBrandingError(`Não foi possível carregar a organização. ${ApiErrorMessage(org.error)}`);
    });

    const refresh = async () => {
      const feed = await api.organizations.feed(orgId);
      if (!active) return;
      if (!feed.ok) {
        setFeedError(`Não foi possível atualizar os eventos. ${ApiErrorMessage(feed.error)}`);
        return;
      }
      setEvents(feed.value.map(ToTvEvent));
      setFeedError(null);
    };

    void refresh();
    const timer = setInterval(() => void refresh(), TV_REFRESH_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  if (PUBLIC_ORG_ID === null) {
    return (
      <main className="min-h-dvh center p-8">
        <ErrorAlert className="text-xl max-w-2xl">{MISSING_ORG_MESSAGE}</ErrorAlert>
      </main>
    );
  }

  return (
    <TvDisplay
      branding={branding}
      status={events === null && feedError === null ? "loading" : "ready"}
      events={events === null ? [] : events}
      errors={[brandingError, feedError]}
      qr={qr}
      today={TodayInBrazil()}
    />
  );
}
