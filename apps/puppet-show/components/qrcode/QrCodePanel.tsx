/* components/qrcode/QrCodePanel.tsx */

type QrCodePanelProps = {
  /* SVG OF THE QR CODE, GENERATED ON THE SERVER */
  svg: string;
  /* "side" ON A WIDE SCREEN, "footer" ON A VERTICAL ONE */
  variant?: "side" | "footer";
};

/* SHOWS THE QR CODE THAT TAKES THE VISITOR TO THE SITE ON THEIR PHONE */
export function QrCodePanel({ svg, variant = "side" }: QrCodePanelProps) {
  const isFooter = variant === "footer";

  return (
    <aside className={`card column gap-3 ${isFooter ? "items-center sm:flex-row sm:justify-center sm:gap-6" : "items-center w-80 shrink-0"}`}>
      <div
        className={`bg-white rounded-lg p-3 ${isFooter ? "w-32" : "w-56"}`}
        /* THE SVG COMES FROM THE qrcode LIBRARY ON THE SERVER, NEVER FROM THE VISITOR */
        dangerouslySetInnerHTML={{ __html: svg }}
      />

      <div className={`column gap-1 ${isFooter ? "sm:items-start items-center text-center sm:text-left" : "text-center"}`}>
        <p className="subtitle">
          Participe pelo celular
        </p>

        <p className="text-sm opacity-70">
          Aponte a câmera para o QR Code para curtir e se inscrever nos eventos.
        </p>
      </div>
    </aside>
  );
};
