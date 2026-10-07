/* lib/api/mappers.ts */

/* TURNS API RECORDS INTO THE SHAPES THE COMPONENTS DRAW */

import type { CreateEventInput, Event, FeedEvent } from "./types";
import type { EventItem } from "@/hooks/useEvents";
import type { EventFormData } from "@/utils/validation/EventValidation";

/* THE FIRST UPCOMING DAY IS THE ONE WE SHOW ON CARDS; FALLS BACK TO THE FIRST ONE */
export function NextDay(event: Event) {
  const today = new Date().toISOString().slice(0, 10);
  const days = [...event.schedule].sort((a, b) => a.date.localeCompare(b.date));
  return days.find((day) => day.date >= today) ?? days[0];
};

export function ToEventItem(event: Event | FeedEvent): EventItem {
  const day = NextDay(event);

  return {
    id: event.id,
    title: event.title,
    description: event.description,
    location: event.location,
    date: day?.date ?? "",
    time: day?.startTime ?? "",
    /* THE API DOESN'T SEND THE AUTHOR'S NAME YET */
    authorName: "",
    likes: "voteCount" in event ? event.voteCount : 0,
    subscriptions: 0,
    liked: false,
    subscribed: false,
  };
};

/* THE SIMPLE FORM HAS ONE DAY AND NO TAGS/LINKS; THE API WANTS THE FULL SHAPE */
export function ToCreateEventInput(data: EventFormData): CreateEventInput {
  return {
    title: data.title,
    description: data.description,
    location: data.location,
    isHidden: false,
    schedule: [{ date: data.date, startTime: data.time }],
    tags: [],
    links: [],
  };
};
