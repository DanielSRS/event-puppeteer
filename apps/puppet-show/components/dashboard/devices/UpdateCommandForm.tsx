/**
 * Form of the "update Puppet" command. The new binary comes either from an address the
 * device downloads from (absolute http(s) URL or a path on Puppeteer, with its SHA-256,
 * which Puppet checks before installing) or from a file sent here, whose SHA-256 the
 * browser computes. An optional version label goes with either.
 *
 * @module
 */

"use client";

import { useState } from "react";
import { ErrorAlert } from "@/components/ui/Feedback";
import { ValidateUpdate, type FieldErrors, type UpdateRequest, type UpdateSource, type UpdateValues } from "./deviceForms";

export type UpdateCommandFormProps = {
  saving: boolean;
  /** Why the last attempt failed. */
  error: string;
  /** What the upload is doing right now; empty when it is not running. */
  progress?: string;
  onSubmit: (request: UpdateRequest) => void;
  onCancel: () => void;
};

/** Hints shown under each field. */
const HINTS = {
  url: "Endereço completo (https://...) ou caminho no Puppeteer começando com “/”.",
  sha256: "64 caracteres hexadecimais. O dispositivo recusa um arquivo diferente.",
  version: "Opcional; aparece nos logs do dispositivo.",
  file: "O executável do Puppet, até 64 MB. O SHA-256 é calculado aqui e o arquivo fica guardado de forma privada.",
} as const;

/** The text fields of the form. */
type TextField = "url" | "sha256" | "version";

/** Label of each way to provide the binary. */
const SOURCES: Array<{ value: UpdateSource; label: string }> = [
  { value: "file", label: "Enviar o arquivo" },
  { value: "url", label: "Informar um endereço" },
];

/** The update form. */
export function UpdateCommandForm({ saving, error, progress = "", onSubmit, onCancel }: UpdateCommandFormProps) {
  const [values, setValues] = useState<UpdateValues>({ source: "file", url: "", sha256: "", version: "", file: null });
  const [submitted, setSubmitted] = useState(false);

  const validation = ValidateUpdate(values);
  const errors: FieldErrors<"url" | "sha256" | "file"> = submitted && !validation.ok ? validation.error : {};

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (validation.ok) onSubmit(validation.value);
  };

  /** A labelled input with its hint and error. */
  const field = (name: TextField, label: string, extra: { mono?: boolean; inputMode?: "url" } = {}) => {
    const id = `update-${name}`;
    const error = name === "version" ? undefined : errors[name];
    return (
      <div className="column gap-1">
        <label htmlFor={id}>{label}</label>
        <input
          id={id}
          value={values[name]}
          onChange={(event) => setValues((current) => ({ ...current, [name]: event.target.value }))}
          disabled={saving}
          aria-invalid={error !== undefined}
          aria-describedby={error === undefined ? `${id}-hint` : `${id}-hint ${id}-error`}
          spellCheck={false}
          autoCapitalize="none"
          {...(extra.inputMode !== undefined ? { inputMode: extra.inputMode } : {})}
          className={`input ${extra.mono ? "font-mono text-[13px]" : ""} ${error !== undefined ? "input-error" : ""}`}
        />
        <p id={`${id}-hint`} className="t3 text-[12.5px]">{HINTS[name]}</p>
        {error !== undefined && <p id={`${id}-error`} className="error-message">{error}</p>}
      </div>
    );
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="column gap-4">
      <fieldset disabled={saving} className="column gap-2">
        <legend className="mb-1">Origem do Puppet</legend>
        {SOURCES.map((source) => (
          <label key={source.value} className="flex items-center gap-2">
            <input
              type="radio"
              name="update-source"
              value={source.value}
              checked={values.source === source.value}
              onChange={() => setValues((current) => ({ ...current, source: source.value }))}
            />
            {source.label}
          </label>
        ))}
      </fieldset>

      {values.source === "file" ? (
        <div className="column gap-1">
          <label htmlFor="update-file">Arquivo do Puppet</label>
          <input
            id="update-file"
            type="file"
            disabled={saving}
            onChange={(event) => {
              const file = event.target.files === null || event.target.files.length === 0 ? null : event.target.files[0];
              setValues((current) => ({ ...current, file: file === undefined ? null : file }));
            }}
            aria-invalid={errors.file !== undefined}
            aria-describedby={errors.file === undefined ? "update-file-hint" : "update-file-hint update-file-error"}
            className={`input ${errors.file !== undefined ? "input-error" : ""}`}
          />
          <p id="update-file-hint" className="t3 text-[12.5px]">{HINTS.file}</p>
          {errors.file !== undefined && <p id="update-file-error" className="error-message">{errors.file}</p>}
        </div>
      ) : (
        <>
          {field("url", "Endereço do Puppet", { inputMode: "url" })}
          {field("sha256", "SHA-256", { mono: true })}
        </>
      )}
      {field("version", "Versão (opcional)")}

      {progress !== "" && <p role="status" className="t3 text-[13px]">{progress}</p>}
      <ErrorAlert>{error}</ErrorAlert>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onCancel} disabled={saving} className="button ghost focus-ring">Cancelar</button>
        <button type="submit" disabled={saving} className="button main focus-ring px-6">{saving ? "Enviando..." : "Enviar atualização"}</button>
      </div>
    </form>
  );
}
