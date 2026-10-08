/**
 * Form of the "update Puppet" command: where the device downloads the new
 * binary (absolute http(s) URL or a path on Puppeteer), its SHA-256 (Puppet
 * refuses a file that doesn't match) and an optional version label.
 *
 * @module
 */

"use client";

import { useState } from "react";
import { ErrorAlert } from "@/components/ui/Feedback";
import { ValidateUpdate, type FieldErrors, type UpdatePayload, type UpdateValues } from "./deviceForms";

export type UpdateCommandFormProps = {
  saving: boolean;
  /** Why the last attempt failed. */
  error: string;
  onSubmit: (payload: UpdatePayload) => void;
  onCancel: () => void;
};

/** Hints shown under each field. */
const HINTS: Record<keyof UpdateValues, string> = {
  url: "Endereço completo (https://...) ou caminho no Puppeteer começando com “/”.",
  sha256: "64 caracteres hexadecimais. O dispositivo recusa um arquivo diferente.",
  version: "Opcional; aparece nos logs do dispositivo.",
};

/** The update form. */
export function UpdateCommandForm({ saving, error, onSubmit, onCancel }: UpdateCommandFormProps) {
  const [values, setValues] = useState<UpdateValues>({ url: "", sha256: "", version: "" });
  const [submitted, setSubmitted] = useState(false);

  const validation = ValidateUpdate(values);
  const errors: FieldErrors<keyof UpdateValues> = submitted && !validation.ok ? validation.error : {};

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (validation.ok) onSubmit(validation.value);
  };

  /** A labelled input with its hint and error. */
  const field = (name: keyof UpdateValues, label: string, extra: { mono?: boolean; inputMode?: "url" } = {}) => {
    const id = `update-${name}`;
    const error = errors[name];
    return (
      <div className="column gap-1">
        <label htmlFor={id}>{label}</label>
        <input
          id={id}
          value={values[name]}
          onChange={(event) => setValues((current) => ({ ...current, [name]: event.target.value }))}
          aria-invalid={error !== undefined}
          aria-describedby={error === undefined ? `${id}-hint` : `${id}-hint ${id}-error`}
          spellCheck={false}
          autoCapitalize="none"
          {...(extra.inputMode !== undefined ? { inputMode: extra.inputMode } : {})}
          className={`input min-h-10 ${extra.mono ? "font-mono" : ""} ${error !== undefined ? "input-error" : ""}`}
        />
        <p id={`${id}-hint`} className="text-xs text-foreground/70">{HINTS[name]}</p>
        {error !== undefined && <p id={`${id}-error`} className="error-message">{error}</p>}
      </div>
    );
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="column gap-4">
      {field("url", "Endereço do Puppet", { inputMode: "url" })}
      {field("sha256", "SHA-256", { mono: true })}
      {field("version", "Versão (opcional)")}

      <ErrorAlert>{error}</ErrorAlert>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onCancel} disabled={saving} className="button clean min-h-10">Cancelar</button>
        <button type="submit" disabled={saving} className="button main min-h-10">{saving ? "Enviando..." : "Enviar atualização"}</button>
      </div>
    </form>
  );
}
