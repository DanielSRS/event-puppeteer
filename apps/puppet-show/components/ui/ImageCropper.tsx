/**
 * Picks a picture and crops it to an Image's fixed proportion.
 *
 * The API refuses Images off their proportion and never crops them, so the
 * person chooses the area here: a frame locked to the proportion shows the
 * area, which they zoom (slider) and move (drag, or the arrow buttons for
 * keyboard and screen-reader users). Confirming draws the area at its final
 * size (scaled down to the maximum when larger) and hands it over as a JPEG.
 * The browser applies the photo's EXIF orientation when opening it, so what is
 * shown is what is sent.
 *
 * @module
 */

"use client";

import { useEffect, useId, useRef, useState, type PointerEvent } from "react";
import { MdArrowBack, MdArrowDownward, MdArrowForward, MdArrowUpward, MdCheck, MdClose } from "react-icons/md";
import { ErrorAlert } from "./Feedback";
import { Err, Ok, type Result } from "@/lib/result";
import { CropAt, MaxZoom, MovedCrop, OutputSize, type Crop, type CropRules } from "@/utils/crop";

/** Picture formats the API accepts. */
const ACCEPTED = "image/jpeg,image/png,image/webp";

/** Share of the area's width one press of an arrow button moves it. */
const STEP = 0.05;

/** Width of the preview canvas, in its own pixels. */
const PREVIEW_WIDTH = 640;

export type ImageCropperProps = {
  rules: CropRules;
  /** What the picture is for, e.g. "banner do evento"; used in labels. */
  purpose: string;
  disabled?: boolean;
  /** Receives the cropped picture once the person confirms it. */
  onCropped: (picture: Blob) => void;
};

/** A picture opened for cropping. */
type Opened = { bitmap: ImageBitmap; maxZoom: number };

/** Opens a picked file as a bitmap, oriented as the photo says. */
async function OpenPicture(file: File, rules: CropRules): Promise<Result<Opened, string>> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return Err("Não foi possível abrir esse arquivo como imagem. Escolha uma imagem JPEG, PNG ou WebP.");
  }
  const maxZoom = MaxZoom(bitmap, rules);
  if (!maxZoom.ok) {
    bitmap.close();
    return Err(`A imagem é pequena demais: o recorte precisa ter pelo menos ${rules.minimum.width}×${rules.minimum.height} pixels.`);
  }
  return Ok({ bitmap, maxZoom: maxZoom.value });
}

/** Draws the area of the picture at `size` and encodes it as a JPEG. */
async function CroppedPicture(bitmap: ImageBitmap, crop: Crop, size: { width: number; height: number }): Promise<Result<Blob, string>> {
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d");
  if (context === null) return Err("O navegador não conseguiu preparar o recorte.");
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, crop.x, crop.y, crop.width, crop.height, 0, 0, size.width, size.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
  return blob === null ? Err("O navegador não conseguiu gerar a imagem recortada.") : Ok(blob);
}

/** File picker, then the cropping frame with its controls. */
export function ImageCropper({ rules, purpose, disabled = false, onCropped }: ImageCropperProps) {
  const inputId = useId();
  const zoomId = useId();
  const hintId = useId();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const [opened, setOpened] = useState<Opened | null>(null);
  const [zoom, setZoom] = useState(1);
  const [crop, setCrop] = useState<Crop | null>(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [across, down] = rules.proportion;

  useEffect(() => () => opened?.bitmap.close(), [opened]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (opened === null || crop === null || canvas === null) return;
    const context = canvas.getContext("2d");
    if (context === null) return;
    context.drawImage(opened.bitmap, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height);
  }, [opened, crop]);

  async function pick(file: File | undefined) {
    if (file === undefined) return;
    setError("");
    const result = await OpenPicture(file, rules);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOpened(result.value);
    setZoom(1);
    setCrop(CropAt(result.value.bitmap, rules, 1, null));
  }

  function zoomTo(value: number) {
    if (opened === null || crop === null) return;
    setZoom(value);
    setCrop(CropAt(opened.bitmap, rules, value, { x: crop.x + crop.width / 2, y: crop.y + crop.height / 2 }));
  }

  function move(dx: number, dy: number) {
    if (opened === null || crop === null) return;
    setCrop(MovedCrop(opened.bitmap, crop, dx, dy));
  }

  /** Moves the area against the drag: dragging the picture right shows more of its left side. */
  function dragMove(event: PointerEvent<HTMLCanvasElement>) {
    const from = drag.current;
    if (from === null || from.pointerId !== event.pointerId || crop === null) return;
    const scale = crop.width / event.currentTarget.getBoundingClientRect().width;
    move((from.x - event.clientX) * scale, (from.y - event.clientY) * scale);
    drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
  }

  async function confirm() {
    if (opened === null || crop === null) return;
    setWorking(true);
    const picture = await CroppedPicture(opened.bitmap, crop, OutputSize(crop, rules));
    setWorking(false);
    if (!picture.ok) {
      setError(picture.error);
      return;
    }
    setOpened(null);
    setCrop(null);
    onCropped(picture.value);
  }

  function cancel() {
    setOpened(null);
    setCrop(null);
    setError("");
  }

  if (opened === null || crop === null) {
    return (
      <div className="column gap-2">
        <label htmlFor={inputId}>Escolher imagem para o {purpose}</label>
        <input
          id={inputId}
          type="file"
          accept={ACCEPTED}
          disabled={disabled}
          aria-describedby={hintId}
          onChange={(event) => { void pick(event.target.files?.[0]); event.target.value = ""; }}
          className="input"
        />
        <p id={hintId} className="text-sm text-foreground/80">
          JPEG, PNG ou WebP. Depois de escolher, você recorta a imagem na proporção {across}:{down}
          {" "}(mínimo de {rules.minimum.width}×{rules.minimum.height} pixels).
        </p>
        <ErrorAlert>{error}</ErrorAlert>
      </div>
    );
  }

  const busy = disabled || working;
  const step = crop.width * STEP;

  return (
    <div className="column gap-3">
      <canvas
        ref={canvasRef}
        width={PREVIEW_WIDTH}
        height={Math.round((PREVIEW_WIDTH * down) / across)}
        role="img"
        aria-label={`Prévia do recorte do ${purpose}. Arraste para mover o recorte.`}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
        }}
        onPointerMove={dragMove}
        onPointerUp={() => { drag.current = null; }}
        onPointerCancel={() => { drag.current = null; }}
        className="w-full touch-none cursor-move rounded-lg border border-muted bg-muted"
      />

      <div className="column gap-1">
        <label htmlFor={zoomId}>Zoom do recorte</label>
        <input
          id={zoomId}
          type="range"
          min={1}
          max={opened.maxZoom}
          step="any"
          value={zoom}
          disabled={busy || opened.maxZoom === 1}
          onChange={(event) => zoomTo(Number(event.target.value))}
        />
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Mover o recorte">
        <button type="button" disabled={busy} onClick={() => move(-step, 0)} className="button clean min-h-10" aria-label="Mover o recorte para a esquerda"><MdArrowBack aria-hidden className="icon" /></button>
        <button type="button" disabled={busy} onClick={() => move(step, 0)} className="button clean min-h-10" aria-label="Mover o recorte para a direita"><MdArrowForward aria-hidden className="icon" /></button>
        <button type="button" disabled={busy} onClick={() => move(0, -step)} className="button clean min-h-10" aria-label="Mover o recorte para cima"><MdArrowUpward aria-hidden className="icon" /></button>
        <button type="button" disabled={busy} onClick={() => move(0, step)} className="button clean min-h-10" aria-label="Mover o recorte para baixo"><MdArrowDownward aria-hidden className="icon" /></button>
      </div>

      <ErrorAlert>{error}</ErrorAlert>

      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => void confirm()} className="button min-h-10">
          <MdCheck aria-hidden className="icon" /> {working ? "Recortando..." : "Usar este recorte"}
        </button>
        <button type="button" disabled={busy} onClick={cancel} className="button clean min-h-10">
          <MdClose aria-hidden className="icon" /> Escolher outra imagem
        </button>
      </div>
    </div>
  );
}
