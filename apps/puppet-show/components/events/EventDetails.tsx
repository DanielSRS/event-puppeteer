/**
 * Everything about one event: schedule, place and map, tags, links and the
 * actions people can take (like, share, report; hide for moderators; delete,
 * and change or remove the banner, for the creator).
 *
 * @module
 */

import Link from "next/link";
import type { ReactNode } from "react";
import type { IconType } from "react-icons";
import {
  MdCalendarToday, MdDeleteOutline, MdDescription, MdFlag, MdHowToReg, MdLanguage, MdLink, MdLocationOn, MdMap,
  MdOndemandVideo, MdPeople, MdShare, MdVisibility, MdVisibilityOff,
} from "react-icons/md";
import { ErrorAlert, StatusMessage } from "@/components/ui/Feedback";
import { ImageCropper } from "@/components/ui/ImageCropper";
import { ImageWithPlaceholder } from "@/components/ui/ImageWithPlaceholder";
import { BANNER_RULES } from "@/utils/crop";
import type { ShownVote } from "@/domain/likes";
import { IsSafeHttpUrl, LinkKindFor, OsmEmbedUrl, OsmPageUrl, type LinkKind } from "@/domain/links";
import { FullDate, TimeRange } from "@/domain/schedule";
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
};

/** A titled block of the page. */
function Section({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="column gap-3">
      <h2 className="row gap-2 text-lg font-semibold">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

/** One external link as a button with its icon; an address that isn't http(s) is shown, not linked. */
function LinkButton({ link }: { link: DetailLink }) {
  const name = link.label === null ? link.url : link.label;
  const Icon = LINK_ICONS[link.label === null ? "generic" : LinkKindFor(link.label)];

  if (!IsSafeHttpUrl(link.url)) {
    return <p className="text-sm text-danger break-all">Link inválido ({name}): {link.url}</p>;
  }

  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`button touch justify-start ${LinkKindFor(name) === "registration" ? "main" : "clean"}`}
    >
      <Icon aria-hidden className="icon shrink-0" />
      <span className="break-all">{name}</span>
      <span className="sr-only">(abre em nova aba)</span>
    </a>
  );
}

/** The details page body. */
export function EventDetails({
  event, likes, likeBusy = false, canModerate, isCreator, canDelete, reported, loginPrompt, loginRedirect, notice, error,
  onToggleLike, onShare, onReport, onHide, onUnhide, onDelete, bannerBusy, onReplaceBanner, onRemoveBanner,
}: EventDetailsProps) {
  return (
    <>
    {event.banner !== null && event.banner.url !== undefined && (
      // The page takes its colors from the banner: a blurred copy fills the background.
      // Kept outside the glass card: backdrop-filter would trap a fixed child inside it.
      <div aria-hidden className="photo-backdrop">
        {/* eslint-disable-next-line @next/next/no-img-element -- decorative copy of the signed banner URL */}
        <img src={event.banner.url} alt="" />
      </div>
    )}
    <article aria-labelledby="event-title" className="glass w-full max-w-4xl mx-auto rounded-[2rem] overflow-hidden">
      {event.banner !== null && (
        <ImageWithPlaceholder image={event.banner} alt={`Banner do evento ${event.title}`} className="aspect-video w-full" />
      )}

      <div className="column gap-6 p-4 sm:p-8">
        <header className="column gap-3">
          {event.isHidden && (
            <p className="row gap-2 text-sm rounded-lg border border-main/40 bg-main/10 p-3">
              <MdVisibilityOff aria-hidden className="icon shrink-0" />
              Oculto pela moderação: este evento não aparece no mural nem nos totens. Só você e a moderação conseguem vê-lo.
            </p>
          )}
          <TagChips tags={event.tags} />
          <h1 id="event-title" className="title break-words">{event.title}</h1>
        </header>

        <div className="flex flex-wrap items-center gap-2">
          <LikeButton title={event.title} voted={likes.voted} count={likes.count} busy={likeBusy} onToggle={onToggleLike} />
          <span className="sr-only" aria-live="polite">{LikesLabel(likes.count)}</span>

          <button type="button" onClick={onShare} className="button clean touch">
            <MdShare aria-hidden className="icon" />
            Compartilhar
          </button>

          {!isCreator && (
            <button type="button" onClick={onReport} disabled={reported} className="button clean touch hover:border-danger">
              <MdFlag aria-hidden className="icon" />
              {reported ? "Denunciado" : "Denunciar"}
            </button>
          )}

          {canModerate && (event.isHidden ? (
            <button type="button" onClick={onUnhide} className="button clean touch">
              <MdVisibility aria-hidden className="icon" />
              Reexibir evento
            </button>
          ) : (
            <button type="button" onClick={onHide} className="button clean touch">
              <MdVisibilityOff aria-hidden className="icon" />
              Ocultar evento
            </button>
          ))}

          {canDelete && (
            <button type="button" onClick={onDelete} className="button clean touch text-danger hover:border-danger">
              <MdDeleteOutline aria-hidden className="icon" />
              Excluir
            </button>
          )}
        </div>

        {loginPrompt !== null && (
          <p role="status" className="text-sm rounded-lg border border-main/40 bg-main/10 p-3">
            Você precisa entrar na sua conta para {loginPrompt} eventos.{" "}
            <Link href={`/entrar?redirect=${encodeURIComponent(loginRedirect)}`} className="text-main underline font-medium">
              Entrar
            </Link>
          </p>
        )}
        <StatusMessage>{notice}</StatusMessage>
        <ErrorAlert>{error}</ErrorAlert>

        {isCreator && (
          <details className="rounded-lg border border-muted p-3">
            <summary className="cursor-pointer font-medium">{event.banner === null ? "Adicionar banner" : "Trocar ou remover o banner"}</summary>
            <div className="column gap-3 pt-3">
              <ImageCropper rules={BANNER_RULES} purpose="banner do evento" disabled={bannerBusy} onCropped={onReplaceBanner} />
              {event.banner !== null && (
                <button type="button" disabled={bannerBusy} onClick={onRemoveBanner} className="button clean self-start min-h-10 text-danger hover:border-danger">
                  <MdDeleteOutline aria-hidden className="icon" />
                  Remover banner
                </button>
              )}
            </div>
          </details>
        )}

        <p className="whitespace-pre-line break-words">{event.description}</p>

        <div className="grid gap-8 md:grid-cols-2">
          <Section title="Programação" icon={<MdCalendarToday aria-hidden className="text-main" />}>
            {event.schedule.length === 0 ? (
              <p className="text-sm text-foreground/80">Sem data definida.</p>
            ) : (
              <ol className="column gap-2">
                {event.schedule.map((day) => (
                  <li key={day.date} className="column rounded-2xl border border-muted bg-well p-3">
                    <span className="font-medium first-letter:uppercase">{FullDate(day.date)}</span>
                    <span className="text-sm text-foreground/80">{TimeRange(day)}</span>
                  </li>
                ))}
              </ol>
            )}
          </Section>

          <div className="column gap-8 min-w-0">
            <Section title="Local" icon={<MdLocationOn aria-hidden className="text-main" />}>
              <p className="rounded-2xl border border-muted bg-well p-3 break-words">{event.location}</p>
              {event.coordinates !== null && (
                <>
                  <iframe
                    title={`Mapa: ${event.location}`}
                    src={OsmEmbedUrl(event.coordinates)}
                    loading="lazy"
                    className="aspect-video w-full rounded-lg border border-muted bg-muted"
                  />
                  <a
                    href={OsmPageUrl(event.coordinates)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="button clean touch self-start"
                  >
                    <MdMap aria-hidden className="icon" />
                    Abrir no mapa
                    <span className="sr-only">(abre em nova aba)</span>
                  </a>
                </>
              )}
            </Section>

            {event.links.length > 0 && (
              <Section title="Links" icon={<MdLink aria-hidden className="text-main" />}>
                <ul className="column gap-2">
                  {event.links.map((link, index) => (
                    <li key={`${link.url}-${index}`} className="column">
                      <LinkButton link={link} />
                    </li>
                  ))}
                </ul>
              </Section>
            )}
          </div>
        </div>
      </div>
    </article>
    </>
  );
}
