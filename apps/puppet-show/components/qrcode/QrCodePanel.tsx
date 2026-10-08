/**
 * Invites people looking at a big screen to open the site on their phone.
 *
 * @module
 */

import { useId } from "react";
import { ErrorAlert } from "@/components/ui/Feedback";
import type { SiteQr } from "./siteQrCode";

export type QrCodePanelProps = {
  /** The QR code generated on the server, or why it couldn't be. */
  qr: SiteQr;
  /** `"side"`: card next to the feed; `"tv"`: large, for the TV display. */
  variant?: "side" | "tv";
};

/** The site's QR code with a short call to action; says what's wrong when there is no code. */
export function QrCodePanel({ qr, variant = "side" }: QrCodePanelProps) {
  const isTv = variant === "tv";
  const titleId = useId();

  return (
    <section aria-labelledby={titleId} className={`card column items-center gap-3 text-center ${isTv ? "bg-background" : ""}`}>
      <h2 id={titleId} className={isTv ? "text-2xl font-bold text-main" : "subtitle"}>
        Participe pelo celular
      </h2>

      {qr.ok ? (
        <>
          <div
            role="img"
            aria-label={`QR Code para ${qr.value.url}`}
            className={`bg-white rounded-lg p-2 ${isTv ? "w-56" : "w-44"}`}
            dangerouslySetInnerHTML={{ __html: qr.value.svg }}
          />
          <p className={isTv ? "text-base text-foreground/80" : "text-sm text-foreground/80"}>
            Aponte a câmera para o QR Code para curtir os eventos e ver os detalhes.
          </p>
          <p className="text-xs text-foreground/80 break-all">{qr.value.url}</p>
        </>
      ) : (
        <ErrorAlert className="text-left">{qr.error}</ErrorAlert>
      )}
    </section>
  );
}
