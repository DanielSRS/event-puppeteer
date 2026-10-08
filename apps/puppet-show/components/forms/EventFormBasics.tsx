/**
 * Step 1 of the event editor: what the event is and where it happens,
 * including optional coordinates with a map preview.
 *
 * @module
 */

"use client";

import { useState } from "react";
import { MdMyLocation } from "react-icons/md";
import { ErrorAlert } from "@/components/ui/Feedback";
import type { Result } from "@/lib/result";
import { HasEventErrors, ValidateCoordinates, type EventFormData, type EventFormErrors } from "@/utils/validation/EventValidation";
import { FieldA11y, FieldError, FieldId } from "./EventFormField";

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
      <div className="column">
        <label htmlFor={id("title")}>Nome do evento</label>
        <input
          {...FieldA11y(id("title"), errors.title)}
          type="text"
          value={data.title}
          disabled={disabled}
          onChange={(event) => onChange({ title: event.target.value })}
          className={`input ${errors.title ? "input-error" : ""}`}
          placeholder="Ex.: Feira de Ciências"
          maxLength={120}
        />
        <FieldError fieldId={id("title")} error={errors.title} />
      </div>

      <div className="column">
        <label htmlFor={id("description")}>Descrição</label>
        <textarea
          {...FieldA11y(id("description"), errors.description)}
          value={data.description}
          disabled={disabled}
          onChange={(event) => onChange({ description: event.target.value })}
          className={`input min-h-32 resize-y ${errors.description ? "input-error" : ""}`}
          placeholder="Conte o que vai acontecer, quem pode participar e o que levar."
          maxLength={2000}
        />
        <FieldError fieldId={id("description")} error={errors.description} />
      </div>

      <div className="column">
        <label htmlFor={id("location")}>Local</label>
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

      <fieldset className="column gap-3 rounded-xl border border-muted p-4 min-w-0">
        <legend className="px-1 text-sm font-semibold">Coordenadas (opcional)</legend>
        <p id={coordinatesHint} className="text-sm text-foreground/80">
          Ajudam as pessoas a encontrar o local no mapa. Use graus decimais, com ponto.
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="column min-w-0">
            <label htmlFor={id("latitude")}>Latitude</label>
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
              className={`input ${errors.latitude ? "input-error" : ""}`}
              placeholder="-12.2000"
            />
            <FieldError fieldId={id("latitude")} error={errors.latitude} />
          </div>
          <div className="column min-w-0">
            <label htmlFor={id("longitude")}>Longitude</label>
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
              className={`input ${errors.longitude ? "input-error" : ""}`}
              placeholder="-38.9700"
            />
            <FieldError fieldId={id("longitude")} error={errors.longitude} />
          </div>
        </div>

        <button type="button" onClick={locate} disabled={disabled || locating} className="button clean self-start min-h-10">
          <MdMyLocation aria-hidden className="icon" />
          {locating ? "Obtendo localização..." : "Usar minha localização"}
        </button>
        <ErrorAlert>{locateError}</ErrorAlert>

        {showMap && (
          <iframe
            title="Mapa com a localização do evento"
            src={MapEmbedUrl({ latitude: Number(latitude), longitude: Number(longitude) })}
            className="h-56 w-full rounded-lg border border-muted"
            loading="lazy"
          />
        )}
      </fieldset>
    </div>
  );
}
