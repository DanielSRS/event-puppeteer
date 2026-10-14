/**
 * Invites people looking at a big screen to open the site on their phone:
 * a compact row (code plus a short call to action) at the foot of the feed's
 * "Próximos 7 dias" rail, or a tile of the TV display's bento.
 *
 * @module
 */

import { useId } from "react";
import { ErrorAlert } from "@/components/ui/Feedback";
import type { SiteQr } from "./siteQrCode";

export type QrCodePanelProps = {
  /** The QR code generated on the server, or why it couldn't be. */
  qr: SiteQr;
  /** `"side"`: compact row beside the feed; `"tv"`: tile of the TV display (inside an element with `.tv`). */
  variant?: "side" | "tv";
};

/** The site's QR code with a short call to action; says what's wrong when there is no code. */
export function QrCodePanel({ qr, variant = "side" }: QrCodePanelProps) {
  const isTv = variant === "tv";
  const titleId = useId();

  if (!isTv) {
    return (
      <section aria-labelledby={titleId} className="row items-center gap-3.5">
        {qr.ok && (
          <div
            role="img"
            aria-label={`QR Code para ${qr.value.url}`}
            className="h-[76px] w-[76px] shrink-0 rounded-xl bg-white p-1 [&_svg]:h-full [&_svg]:w-full"
            dangerouslySetInnerHTML={{ __html: qr.value.svg }}
          />
        )}
        <div className="column min-w-0 flex-1 gap-0.5">
          <h2 id={titleId} className="text-[15px] font-semibold">Leve o mural no bolso</h2>
          {qr.ok
            ? <p className="t3 text-[13px]">Aponte a câmera e curta seus eventos favoritos.</p>
            : <ErrorAlert className="mt-1.5">{qr.error}</ErrorAlert>}
        </div>
      </section>
    );
  }

  // TV bento tile; sizes follow the TV's `--u` scale (see `.tv` in globals.css).
  return (
    <section aria-labelledby={titleId} className="column items-center justify-center gap-[calc(14*var(--u))] text-center">
      {qr.ok ? (
        <div
          role="img"
          aria-label={`QR Code para ${qr.value.url}`}
          className="h-[calc(128*var(--u))] w-[calc(128*var(--u))] min-h-24 min-w-24 rounded-[calc(14*var(--u))] bg-white p-[calc(10*var(--u))] [&_svg]:h-full [&_svg]:w-full"
          dangerouslySetInnerHTML={{ __html: qr.value.svg }}
        />
      ) : (
        <ErrorAlert className="text-left">{qr.error}</ErrorAlert>
      )}
      <h2 id={titleId} className="text-[max(15px,calc(19*var(--u)))] font-semibold leading-[1.3]">
        Curta, inscreva-se<br />e crie eventos
      </h2>
    </section>
  );
}
