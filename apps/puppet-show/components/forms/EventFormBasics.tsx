/**
 * Step 1 of the event editor: what the event is and where it happens,
 * including an optional point on the map (coordinates, "Usar minha
 * localização" and a map preview) grouped in a box.
 *
 * @module
 */

"use client";

import { useState } from "react";
import { MdMyLocation } from "react-icons/md";
import { ErrorAlert } from "@/components/ui/Feedback";
import type { Result } from "@/lib/result";
import { HasEventErrors, ValidateCoordinates, type EventFormData, type EventFormErrors } from "@/utils/validation/EventValidation";
import {
  FIELD, FIELD_BOX, FIELD_BOX_LEGEND, FIELD_HINT, FIELD_LABEL, FieldA11y, FieldBoxBorder, FieldError, FieldId,
} from "./EventFormField";

/** A position from the device. */
export type Coordinates = { latitude: number; longitude: number };

/** Props of {@link EventFormBasics}. */
export type EventFormBasicsProps = {
  /** Prefix of every element id in the editor. */
  idPrefix: string;
  data: EventFormData;
  /** Errors to show (only for steps the person already tried to leave). */
  errors: EventFormErrors;
  disabled: boolean;
  onChange: (patch: Partial<EventFormData>) => void;
  /** Asks the device for its position; the error is a message for the person. */
  onLocate: () => Promise<Result<Coordinates, string>>;
};

/** OpenStreetMap embed centred on the coordinates, with a marker. */
export function MapEmbedUrl({ latitude, longitude }: Coordinates): string {
  const delta = 0.005;
  const bbox = [longitude - delta, latitude - delta, longitude + delta, latitude + delta].join(",");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${latitude},${longitude}`;
}

/** Title, description, location and coordinates. */
export function EventFormBasics({ idPrefix, data, errors, disabled, onChange, onLocate }: EventFormBasicsProps) {
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState("");

  const id = (path: string) => FieldId(idPrefix, path);
  const coordinatesHint = id("coordinates-hint");

  const latitude = data.latitude.trim();
  const longitude = data.longitude.trim();
  const showMap = latitude !== "" && longitude !== "" && !HasEventErrors(ValidateCoordinates(data));

  async function locate() {
    setLocating(true);
    setLocateError("");
    const position = await onLocate();
    setLocating(false);
    if (!position.ok) {
      setLocateError(position.error);
      return;
    }
    onChange({ latitude: position.value.latitude.toFixed(6), longitude: position.value.longitude.toFixed(6) });
  }

  return (
    <div className="column gap-4">
      <div className={FIELD}>
        <label htmlFor={id("title")} className={FIELD_LABEL}>Nome do evento</label>
        <input
          {...FieldA11y(id("title"), errors.title)}
          type="text"
          value={data.title}
          disabled={disabled}
          onChange={(event) => onChange({ title: event.target.value })}
          className={`input min-h-[50px] text-base ${errors.title ? "input-error" : ""}`}
          placeholder="Ex.: Feira de Ciências"
          maxLength={120}
        />
        <FieldError fieldId={id("title")} error={errors.title} />
      </div>

      <div className={FIELD}>
        <label htmlFor={id("description")} className={FIELD_LABEL}>Descrição</label>
        <textarea
          {...FieldA11y(id("description"), errors.description)}
          rows={5}
          value={data.description}
          disabled={disabled}
          onChange={(event) => onChange({ description: event.target.value })}
          className={`input min-h-32 resize-y py-3 ${errors.description ? "input-error" : ""}`}
          placeholder="Conte o que vai acontecer, quem pode participar e o que levar."
          maxLength={2000}
        />
        <FieldError fieldId={id("description")} error={errors.description} />
      </div>

      <div className={FIELD}>
        <label htmlFor={id("location")} className={FIELD_LABEL}>Local</label>
        <input
          {...FieldA11y(id("location"), errors.location)}
          type="text"
          value={data.location}
          disabled={disabled}
          onChange={(event) => onChange({ location: event.target.value })}
          className={`input ${errors.location ? "input-error" : ""}`}
          placeholder="Ex.: Auditório Central"
        />
        <FieldError fieldId={id("location")} error={errors.location} />
      </div>

      <fieldset className={`${FIELD_BOX} ${FieldBoxBorder(errors.latitude !== undefined || errors.longitude !== undefined)}`}>
        <legend className={FIELD_BOX_LEGEND}>
          Ponto no mapa <span className="font-normal text-fg-3">(opcional)</span>
        </legend>
        <p id={coordinatesHint} className={FIELD_HINT}>
          Ajudam as pessoas a encontrar o local no mapa. Use graus decimais, com ponto.
        </p>

        <div className="flex flex-wrap items-end gap-2.5">
          <div className={`${FIELD} flex-[1_1_120px]`}>
            <label htmlFor={id("latitude")} className={FIELD_LABEL}>Latitude</label>
            <input
              {...FieldA11y(id("latitude"), errors.latitude, coordinatesHint)}
              type="number"
              inputMode="decimal"
              step="any"
              min={-90}
              max={90}
              value={data.latitude}
              disabled={disabled}
              onChange={(event) => onChange({ latitude: event.target.value })}
              className={`input font-mono ${errors.latitude ? "input-error" : ""}`}
              placeholder="-12.2000"
            />
          </div>
          <div className={`${FIELD} flex-[1_1_120px]`}>
            <label htmlFor={id("longitude")} className={FIELD_LABEL}>Longitude</label>
            <input
              {...FieldA11y(id("longitude"), errors.longitude, coordinatesHint)}
              type="number"
              inputMode="decimal"
              step="any"
              min={-180}
              max={180}
              value={data.longitude}
              disabled={disabled}
              onChange={(event) => onChange({ longitude: event.target.value })}
              className={`input font-mono ${errors.longitude ? "input-error" : ""}`}
              placeholder="-38.9700"
            />
          </div>
          <button type="button" onClick={locate} disabled={disabled || locating} className="button min-h-12 flex-[1_1_200px]">
            <MdMyLocation aria-hidden className="h-4 w-4" />
            {locating ? "Obtendo localização..." : "Usar minha localização"}
          </button>
        </div>
        <FieldError fieldId={id("latitude")} error={errors.latitude} />
        <FieldError fieldId={id("longitude")} error={errors.longitude} />
        <ErrorAlert>{locateError}</ErrorAlert>

        {showMap && (
          <iframe
            title="Mapa com a localização do evento"
            src={MapEmbedUrl({ latitude: Number(latitude), longitude: Number(longitude) })}
            className="h-40 w-full rounded-2xl border border-line sm:h-48"
            loading="lazy"
          />
        )}
      </fieldset>
    </div>
  );
}
