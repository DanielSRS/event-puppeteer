'use client';

import React, { useState, useEffect, useSyncExternalStore } from 'react';
import { TvDisplay, TvEvent } from './TvDisplay';
import { api } from '@/lib/api/client';
import { NextDay } from '@/lib/api/mappers';
import { MISSING_ORG_MESSAGE, PUBLIC_ORG_ID } from '@/lib/api/session';

const REFRESH_INTERVAL = 300000; // 5 min

export function TvDisplayContainer() {
  const [events, setEvents] = useState<TvEvent[]>([]);
  const [orgName, setOrgName] = useState('');
  // The QR code points at this same site; the server render falls back to the configured URL
  const appUrl = useSyncExternalStore(
    () => () => {},
    () => process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin,
    () => process.env.NEXT_PUBLIC_SITE_URL ?? '',
  );

  useEffect(() => {
    if (!PUBLIC_ORG_ID) return;
    const orgId = PUBLIC_ORG_ID;

    api.organizations.get(orgId)
      .then(org => setOrgName(org.name))
      .catch(() => setOrgName(''));

    // A TV is unattended: on failure it keeps the last list and tries again next round
    const fetchEvents = () => {
      api.organizations.feed(orgId)
        .then(feed => setEvents(feed.map(e => {
          const day = NextDay(e);
          return {
            id: e.id,
            title: e.title,
            date: day?.date ?? '',
            time: day?.startTime ?? '',
            location: e.location,
            imageUrl: e.bannerImage,
          };
        })))
        .catch(() => {});
    };

    fetchEvents();
    const interval = setInterval(fetchEvents, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  if (!PUBLIC_ORG_ID)
    return <div className="min-h-screen flex items-center justify-center p-8 text-center text-gray-500">{MISSING_ORG_MESSAGE}</div>;

  return (
    <TvDisplay 
      events={events} 
      appUrl={appUrl} 
      orgName={orgName} 
    />
  );
}
