/**
 * Everything about one event: schedule, place and map, tags, links and the
 * actions people can take (like, share, report; hide for moderators; delete,
 * and change or remove the banner, for the creator).
 *
 * Laid out as the design's two columns: banner, title and description, then
 * "Programação" and "Local" on the left; on the right a summary card (dates,
 * time, place, the registration link and the like/share/report buttons) and
 * the other links. On phones the summary comes right after the description.
 *
 * @module
 */

import Link from "next/link";
import type { ReactNode } from "react";
import type { IconType } from "react-icons";
import {
  MdAccessTime, MdCalendarToday, MdDeleteOutline, MdDescription, MdFlag, MdHowToReg, MdLanguage, MdLink,
  MdLocationOn, MdMap, MdOndemandVideo, MdOpenInNew, MdPeople, MdShare, MdVisibility, MdVisibilityOff,
} from "react-icons/md";
import { ErrorAlert, StatusMessage } from "@/components/ui/Feedback";
import { ImageCropper } from "@/components/ui/ImageCropper";
import { ImageWithPlaceholder } from "@/components/ui/ImageWithPlaceholder";
import { BANNER_RULES } from "@/utils/crop";
import type { ShownVote } from "@/domain/likes";
import { IsSafeHttpUrl, LinkKindFor, OsmEmbedUrl, OsmPageUrl, type LinkKind } from "@/domain/links";
import { DateBadge as BadgeParts, DaysBetween, FullDate, NextDay, ShortDate, SortedDays, TimeRange } from "@/domain/schedule";
import type { DetailLink, EventDetail } from "@/lib/api/mappers";
import { LikeButton, LikesLabel, TagChips } from "./EventParts";

/** Icon per kind of link label. */
const LINK_ICONS: Record<LinkKind, IconType> = {
  registration: MdHowToReg,
  website: MdLanguage,
  social: MdPeople,
  video: MdOndemandVideo,
  document: MdDescription,
  generic: MdLink,
};

/** Which action asked an anonymous visitor to log in. */
export type LoginPrompt = "curtir" | "denunciar";

export type EventDetailsProps = {
  event: EventDetail;
  /** The like button's state: count and whether the viewer liked it. */
  likes: ShownVote;
  likeBusy?: boolean;
  /** Moderator, Admin of the event's organization, or Superadmin. */
  canModerate: boolean;
  /** The viewer created the event. */
  isCreator: boolean;
  /** The viewer may delete the event: its creator or a Superadmin. */
  canDelete: boolean;
  /** The viewer already reported this event (from the API's report status). */
  reported: boolean;
  /** Set after an anonymous visitor tried an action that needs an account. */
  loginPrompt: LoginPrompt | null;
  /** Path of this page, to come back after logging in. */
  loginRedirect: string;
  /** Confirmation of the last action. */
  notice: string;
  /** Why the last action failed. */
  error: string;
  onToggleLike: () => void;
  onShare: () => void;
  onReport: () => void;
  onHide: () => void;
  onUnhide: () => void;
  onDelete: () => void;
  /** While the creator's banner change is being sent. */
  bannerBusy: boolean;
  /** The creator picked and cropped a new banner. */
  onReplaceBanner: (picture: Blob) => void;
  /** The creator removed the banner. */
  onRemoveBanner: () => void;
  /** `YYYY-MM-DD` in Brazil; when given, the summary says how far away the event is. */
  today?: string;
};

/** A titled block of the left column. */
function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="column gap-4">
      <h2 id={id} className="h2 text-[26px]">{title}</h2>
      {children}
    </section>
  );
}

/** One line of the summary card: an icon tile, a main line and an optional hint. */
function SummaryRow({ icon: Icon, title, hint }: { icon: IconType; title: string; hint?: string | null }) {
  return (
    <div className="flex items-start gap-3.5">
      <span aria-hidden className="surface-2 center h-10 w-10 shrink-0 rounded-xl">
        <Icon className="h-[19px] w-[19px]" />
      </span>
      <div className="column min-w-0">
        <span className="font-semibold break-words">{title}</span>
        {hint != null && hint !== "" && <span className="t3 text-sm">{hint}</span>}
      </div>
    </div>
  );
}

/** `"15 out"` for one day, `"15 out – 17 out"` for several; `null` without days. */
function DatesTitle(event: EventDetail): string | null {
  const days = SortedDays(event.schedule);
  const first = days[0];
  const last = days[days.length - 1];
  if (first === undefined || last === undefined) return null;
  return days.length === 1 ? ShortDate(first.date) : `${ShortDate(first.date)} – ${ShortDate(last.date)}`;
}

/** How far away the next day is: "É hoje", "Amanhã", "Começa em 3 dias", "Já aconteceu". */
function Countdown(event: EventDetail, today: string): string | null {
  if (event.schedule.length === 0) return null;
  const next = NextDay(event.schedule, today);
  if (next === null) return "Já aconteceu";
  const days = DaysBetween(today, next.date);
  if (days === null) return null;
  if (days === 0) return "É hoje";
  if (days === 1) return "Amanhã";
  return `Começa em ${days} dias`;
}

/** The start of the first day in words, without repeating the schedule's own wording. */
function StartTitle(event: EventDetail): { title: string; hint: string | null } | null {
  const first = SortedDays(event.schedule)[0];
  if (first === undefined) return null;
  if (first.startTime === undefined) return { title: "O dia inteiro", hint: null };
  const hint = event.schedule.length > 1
    ? "Horários de cada dia na programação"
    : first.endTime === undefined ? null : `Termina às ${first.endTime}`;
  return { title: `Começa às ${first.startTime}`, hint };
}

/** The registration link shown as the summary's main button: the first safe one. */
function RegistrationLink(links: DetailLink[]): DetailLink | null {
  const found = links.find((link) => link.label !== null && LinkKindFor(link.label) === "registration" && IsSafeHttpUrl(link.url));
  return found === undefined ? null : found;
}

/** One external link as a row with its icon; an address that isn't http(s) is shown, not linked. */
function LinkRow({ link }: { link: DetailLink }) {
  const name = link.label === null ? link.url : link.label;
  const Icon = LINK_ICONS[link.label === null ? "generic" : LinkKindFor(link.label)];

  if (!IsSafeHttpUrl(link.url)) {
    return <p className="c-bad px-1 text-sm break-all">Link inválido ({name}): {link.url}</p>;
  }

  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      className="nav-item focus-ring min-h-[52px] border border-[var(--line)] text-foreground"
    >
      <Icon aria-hidden className="h-[19px] w-[19px] shrink-0" />
      <span className="flex-1 font-medium break-all">{name}</span>
      <span className="sr-only">(abre em nova aba)</span>
      <MdOpenInNew aria-hidden className="t3 h-4 w-4 shrink-0" />
    </a>
  );
}

/** Classes of the stacked buttons under the summary (icon over label). */
const STACKED = "min-h-16 flex-col gap-1 rounded-2xl px-1 text-[13px]";

/** The details page body. */
export function EventDetails({
  event, likes, likeBusy = false, canModerate, isCreator, canDelete, reported, loginPrompt, loginRedirect, notice, error,
  onToggleLike, onShare, onReport, onHide, onUnhide, onDelete, bannerBusy, onReplaceBanner, onRemoveBanner, today,
}: EventDetailsProps) {
  const dates = DatesTitle(event);
  const start = StartTitle(event);
  const registration = RegistrationLink(event.links);
  const otherLinks = event.links.filter((link) => link !== registration);
  const canReport = !isCreator;

  return (
    <>
    {event.banner !== null && event.banner.url !== undefined && (
      // The page takes its colors from the banner: a blurred copy fills the background.
      <div aria-hidden className="photo-backdrop">
        {/* eslint-disable-next-line @next/next/no-img-element -- decorative copy of the signed banner URL */}
        <img src={event.banner.url} alt="" />
      </div>
    )}
    <article
      aria-labelledby="event-title"
      className="grid w-full grid-cols-1 gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)] lg:grid-rows-[auto_1fr] lg:items-start"
    >
      <div className="column min-w-0 gap-7 lg:col-start-1 lg:row-start-1 lg:gap-[34px]">
        {event.banner !== null && (
          <ImageWithPlaceholder
            image={event.banner}
            alt={`Banner do evento ${event.title}`}
            className="aspect-video w-full rounded-3xl border border-[var(--line-2)] shadow-[0_40px_80px_-40px_rgba(0,0,0,.7)] lg:rounded-[32px]"
          />
        )}

        <header className="column gap-4">
          {event.isHidden && (
            <p className="notice n-warn">
              <MdVisibilityOff aria-hidden className="mt-px h-[18px] w-[18px] shrink-0" />
              Oculto pela moderação: este evento não aparece no mural nem nos totens. Só você e a moderação conseguem vê-lo.
            </p>
          )}
          <TagChips tags={event.tags} />
          <h1
            id="event-title"
            className="font-display text-[40px] font-bold leading-[.98] tracking-[-.035em] break-words lg:text-[clamp(40px,5vw,68px)]"
          >
            {event.title}
          </h1>
          <p className="t2 max-w-[62ch] text-lg leading-relaxed whitespace-pre-line break-words">{event.description}</p>
        </header>

        {isCreator && (
          <details className="glass rounded-[22px] px-5 py-4">
            <summary className="cursor-pointer rounded font-semibold focus-ring">
              {event.banner === null ? "Adicionar banner" : "Trocar ou remover o banner"}
            </summary>
            <div className="column gap-3 pt-4">
              <ImageCropper rules={BANNER_RULES} purpose="banner do evento" disabled={bannerBusy} onCropped={onReplaceBanner} />
              {event.banner !== null && (
                <button type="button" disabled={bannerBusy} onClick={onRemoveBanner} className="button danger-soft focus-ring self-start">
                  <MdDeleteOutline aria-hidden className="icon" />
                  Remover banner
                </button>
              )}
            </div>
          </details>
        )}
      </div>

      <aside aria-label="Resumo e ações" className="column min-w-0 gap-4 lg:col-start-2 lg:row-span-2 lg:row-start-1">
        <div className="glass column gap-5 rounded-[28px] p-[22px]">
          <div className="column gap-3.5">
            <SummaryRow
              icon={MdCalendarToday}
              title={dates === null ? "Sem data definida" : dates}
              hint={today === undefined ? null : Countdown(event, today)}
            />
            {start !== null && <SummaryRow icon={MdAccessTime} title={start.title} hint={start.hint} />}
            <SummaryRow icon={MdLocationOn} title={event.location} />
          </div>

          {registration !== null && registration.label !== null && (
            <a
              href={registration.url}
              target="_blank"
              rel="noopener noreferrer"
              className="button main focus-ring min-h-[52px] rounded-2xl text-base"
            >
              {registration.label}
              <span className="sr-only">(abre em nova aba)</span>
              <MdOpenInNew aria-hidden className="icon" />
            </a>
          )}

          <div className={`grid gap-2 ${canReport ? "grid-cols-3" : "grid-cols-2"}`}>
            <LikeButton
              title={event.title}
              voted={likes.voted}
              count={likes.count}
              busy={likeBusy}
              onToggle={onToggleLike}
              className={STACKED}
            />
            <button type="button" onClick={onShare} className={`button focus-ring ${STACKED}`}>
              <MdShare aria-hidden className="icon" />
              Compartilhar
            </button>
            {canReport && (
              <button type="button" onClick={onReport} disabled={reported} className={`button focus-ring ${STACKED}`}>
                <MdFlag aria-hidden className="icon" />
                {reported ? "Denunciado" : "Denunciar"}
              </button>
            )}
          </div>
          <span className="sr-only" aria-live="polite">{LikesLabel(likes.count)}</span>

          {(canModerate || canDelete) && (
            <div className="flex flex-wrap gap-2 border-t border-[var(--line)] pt-4">
              {canModerate && (event.isHidden ? (
                <button type="button" onClick={onUnhide} className="button focus-ring flex-1">
                  <MdVisibility aria-hidden className="icon" />
                  Reexibir evento
                </button>
              ) : (
                <button type="button" onClick={onHide} className="button warn-soft focus-ring flex-1">
                  <MdVisibilityOff aria-hidden className="icon" />
                  Ocultar evento
                </button>
              ))}

              {canDelete && (
                <button type="button" onClick={onDelete} className="button danger-soft focus-ring flex-1">
                  <MdDeleteOutline aria-hidden className="icon" />
                  Excluir
                </button>
              )}
            </div>
          )}

          {loginPrompt !== null && (
            <p role="status" className="notice n-info">
              <span>
                Você precisa entrar na sua conta para {loginPrompt} eventos.{" "}
                <Link href={`/entrar?redirect=${encodeURIComponent(loginRedirect)}`} className="ink rounded font-semibold underline focus-ring">
                  Entrar
                </Link>
              </span>
            </p>
          )}
          <StatusMessage>{notice}</StatusMessage>
          <ErrorAlert>{error}</ErrorAlert>
        </div>

        {otherLinks.length > 0 && (
          <section aria-labelledby="event-links" className="glass column gap-1.5 rounded-[28px] p-[18px]">
            <h2 id="event-links" className="h2 mx-1 mb-1.5 text-lg">Links</h2>
            <ul className="column gap-1.5">
              {otherLinks.map((link, index) => (
                <li key={`${link.url}-${index}`} className="column">
                  <LinkRow link={link} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </aside>

      <div className="column min-w-0 gap-7 lg:col-start-1 lg:row-start-2 lg:gap-[34px]">
        <Section id="event-schedule" title="Programação">
          {event.schedule.length === 0 ? (
            <p className="glass t2 rounded-[22px] px-5 py-4">Sem data definida.</p>
          ) : (
            <ol className="column gap-3">
              {event.schedule.map((day, index) => {
                const badge = BadgeParts(day.date);
                return (
                  <li key={day.date} className="glass flex flex-wrap items-center gap-x-5 gap-y-3 rounded-[22px] px-5 py-4">
                    <span
                      aria-hidden
                      className={`column w-16 shrink-0 items-center rounded-2xl py-2.5 leading-none ${index === 0 ? "bg-accent text-on-accent" : "surface-2"}`}
                    >
                      <span className="font-display text-[26px] font-bold">{badge === null ? "?" : badge.day}</span>
                      <span className={`mt-1 font-mono text-[11px] uppercase ${index === 0 ? "font-semibold" : "t2"}`}>{badge === null ? "" : badge.month}</span>
                    </span>
                    <span className="min-w-0 flex-[1_1_200px] text-[17px] font-semibold first-letter:uppercase">{FullDate(day.date)}</span>
                    <span className="font-mono whitespace-nowrap">{TimeRange(day)}</span>
                  </li>
                );
              })}
            </ol>
          )}
        </Section>

        <Section id="event-place" title="Local">
          <div className="glass overflow-hidden rounded-[26px]">
            {event.coordinates !== null && (
              <iframe
                title={`Mapa: ${event.location}`}
                src={OsmEmbedUrl(event.coordinates)}
                loading="lazy"
                className="well block h-[280px] w-full border-0"
              />
            )}
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-[18px]">
              <span className="min-w-0 text-base font-semibold break-words">{event.location}</span>
              {event.coordinates !== null && (
                <a
                  href={OsmPageUrl(event.coordinates)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="button focus-ring"
                >
                  <MdMap aria-hidden className="icon" />
                  Abrir no mapa
                  <span className="sr-only">(abre em nova aba)</span>
                </a>
              )}
            </div>
          </div>
        </Section>
      </div>
    </article>
    </>
  );
}
