/**
 * Event links and places, as the details page presents them.
 *
 * Links carry a system-wide label (e.g. "Inscrição"); the label decides the
 * icon. Registration for an event is just one of its links: the app has no
 * subscriptions of its own.
 *
 * @module
 */

import { NormalizeText } from "./feed";

/** Which icon a link gets. */
export type LinkKind = "registration" | "website" | "social" | "video" | "document" | "generic";

/** Words in a label that pick each kind, checked in this order (accents and case ignored). */
const KIND_WORDS: ReadonlyArray<[LinkKind, readonly string[]]> = [
  ["registration", ["inscricao", "inscricoes", "inscrever", "ingresso", "ingressos", "registro", "matricula"]],
  ["social", ["instagram", "facebook", "twitter", "linkedin", "whatsapp", "telegram", "rede social"]],
  ["video", ["youtube", "transmissao", "live", "video", "ao vivo"]],
  ["document", ["programacao", "edital", "regulamento", "pdf", "documento"]],
  ["website", ["site", "pagina", "website", "portal"]],
];

/** The icon kind for a link label; `"generic"` when no word matches. */
export function LinkKindFor(label: string): LinkKind {
  const normalized = NormalizeText(label);
  for (const [kind, words] of KIND_WORDS) if (words.some((word) => normalized.includes(word))) return kind;
  return "generic";
}

/** Whether a link should be featured as the main call to action. */
export function IsRegistrationLink(label: string): boolean {
  return LinkKindFor(label) === "registration";
}

/** A point on the map. */
export type Coordinates = { latitude: number; longitude: number };

/** Half the side of the box shown around the marker, in degrees (a few blocks). */
const MAP_SPAN = 0.004;

/** OpenStreetMap embed (for an `<iframe>`) centered on the point, with a marker. */
export function OsmEmbedUrl({ latitude, longitude }: Coordinates): string {
  const bbox = [longitude - MAP_SPAN, latitude - MAP_SPAN, longitude + MAP_SPAN, latitude + MAP_SPAN]
    .map((value) => value.toFixed(6))
    .join(",");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${latitude},${longitude}`;
}

/** OpenStreetMap page with a marker on the point ("Abrir no mapa"). */
export function OsmPageUrl({ latitude, longitude }: Coordinates): string {
  return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`;
}

/**
 * Whether a URL can safely be opened from a link: only absolute http(s)
 * addresses (never `javascript:` or `data:`).
 */
export function IsSafeHttpUrl(url: string): boolean {
  if (!URL.canParse(url)) return false;
  const { protocol } = new URL(url);
  return protocol === "http:" || protocol === "https:";
}
