/**
 * Form with every organization field the API accepts: name, identifier
 * (slug), description, logo, site, colour, location, coordinates and the
 * report threshold. Used to create and edit organizations (Superadmin) and by
 * an Admin to edit their own organization (without the slug).
 *
 * Problems are shown next to each field after the first submit attempt and
 * update as the person types.
 *
 * @module
 */

"use client";

import { useState, type ReactNode } from "react";
import type { Organization, OrganizationInput } from "@/lib/api/schemas";
import { ErrorAlert, StatusMessage } from "@/components/ui/Feedback";
import {
  EmptyOrganizationForm, OrganizationChanges, OrganizationToForm, ToSlug, ValidateOrganizationForm,
  type OrganizationFormErrors, type OrganizationFormField, type OrganizationFormValues,
} from "./organizationForm";

/** Props shared by both modes. */
type CommonProps = {
  /** While true the submit button is disabled and says it's saving. */
  saving: boolean;
  /** Why the last save failed (from the API). */
  error: string;
  /** Slugs of the other organizations. */
  takenSlugs: readonly string[];
  /** Whether the identifier can be edited (Superadmin only). */
  slugEditable: boolean;
  /** Shows a cancel button when given. */
  onCancel?: () => void;
};

export type OrganizationFormProps = CommonProps & (
  | { mode: "create"; onCreate: (body: OrganizationInput) => void }
  | { mode: "edit"; original: Organization; onUpdate: (changes: Partial<OrganizationInput>) => void }
);

/** One labelled field with its hint and error. */
function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div className="column gap-1">
      <label htmlFor={id} className="text-sm">{label}</label>
      {children}
      {hint !== undefined && <p id={`${id}-hint`} className="text-xs text-foreground/70">{hint}</p>}
      {error !== undefined && <p id={`${id}-error`} className="error-message">{error}</p>}
    </div>
  );
}

/** The organization form. */
export function OrganizationForm(props: OrganizationFormProps) {
  const { saving, error, takenSlugs, slugEditable, onCancel } = props;
  const [values, setValues] = useState<OrganizationFormValues>(
    props.mode === "edit" ? OrganizationToForm(props.original) : EmptyOrganizationForm(),
  );
  const [slugTouched, setSlugTouched] = useState(props.mode === "edit");
  const [submitted, setSubmitted] = useState(false);
  const [extraErrors, setExtraErrors] = useState<OrganizationFormErrors>({});
  const [notice, setNotice] = useState("");

  const validation = ValidateOrganizationForm(values, { takenSlugs });
  const errors: OrganizationFormErrors = submitted ? { ...(validation.ok ? {} : validation.error), ...extraErrors } : {};

  const update = (field: OrganizationFormField, value: string) => {
    setNotice("");
    setExtraErrors({});
    setValues((current) => {
      const next = { ...current, [field]: value };
      if (field === "name" && !slugTouched) next.slug = ToSlug(value);
      return next;
    });
  };

  /** Props wiring an input to its label, hint and error. */
  const wire = (field: OrganizationFormField, hint = false) => {
    const id = `org-${field}`;
    const described = [hint ? `${id}-hint` : null, errors[field] !== undefined ? `${id}-error` : null].filter((x) => x !== null);
    return {
      id,
      value: values[field],
      onChange: (event: { target: { value: string } }) => update(field, event.target.value),
      "aria-invalid": errors[field] !== undefined,
      ...(described.length > 0 ? { "aria-describedby": described.join(" ") } : {}),
      className: `input min-h-10 ${errors[field] !== undefined ? "input-error" : ""}`,
    };
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    setNotice("");
    if (!validation.ok) return;

    if (props.mode === "create") {
      props.onCreate(validation.value);
      return;
    }
    const changes = OrganizationChanges(props.original, validation.value);
    if (!changes.ok) { setExtraErrors(changes.error); return; }
    if (Object.keys(changes.value).length === 0) { setNotice("Nada foi alterado."); return; }
    props.onUpdate(changes.value);
  };

  const hasErrors = Object.keys(errors).length > 0;
  const swatch = /^#[0-9a-fA-F]{6}$/.test(values.colorScheme.trim()) ? values.colorScheme.trim() : null;

  return (
    <form onSubmit={handleSubmit} noValidate className="column gap-6">
      <fieldset className="column gap-4">
        <legend className="mb-2 font-medium">Identificação</legend>
        <Field id="org-name" label="Nome" error={errors.name}>
          <input {...wire("name")} autoComplete="organization" />
        </Field>

        {slugEditable ? (
          <Field id="org-slug" label="Identificador (slug)" hint="Usado no endereço. Letras minúsculas, números e hífens." error={errors.slug}>
            <input
              {...wire("slug", true)}
              onChange={(event) => { setSlugTouched(true); update("slug", event.target.value); }}
              className={`${wire("slug").className} font-mono`}
              autoCapitalize="none"
              spellCheck={false}
            />
          </Field>
        ) : (
          <p className="text-sm text-foreground/80">
            Identificador: <span className="font-mono">{values.slug}</span>
          </p>
        )}

        <Field id="org-description" label="Descrição (opcional)" error={errors.description}>
          <textarea {...wire("description")} rows={3} />
        </Field>
      </fieldset>

      <fieldset className="column gap-4">
        <legend className="mb-2 font-medium">Aparência e site</legend>
        <Field id="org-logo" label="Endereço do logo (opcional)" hint="Endereço completo de uma imagem, começando com https://." error={errors.logo}>
          <input {...wire("logo", true)} type="url" inputMode="url" placeholder="https://..." />
        </Field>
        <Field id="org-url" label="Site (opcional)" hint="Endereço completo, começando com https://." error={errors.url}>
          <input {...wire("url", true)} type="url" inputMode="url" placeholder="https://..." />
        </Field>
        <Field id="org-colorScheme" label="Cor principal (opcional)" hint="Formato #rrggbb, por exemplo #2563eb." error={errors.colorScheme}>
          <div className="row gap-3">
            <input {...wire("colorScheme", true)} className={`${wire("colorScheme").className} font-mono`} placeholder="#2563eb" spellCheck={false} />
            {swatch !== null && <span aria-hidden className="h-10 w-10 shrink-0 rounded-lg border border-muted" style={{ backgroundColor: swatch }} />}
          </div>
        </Field>
      </fieldset>

      <fieldset className="column gap-4">
        <legend className="mb-2 font-medium">Localização</legend>
        <Field id="org-location" label="Local (opcional)" error={errors.location}>
          <input {...wire("location")} placeholder="Ex.: Feira de Santana, BA" />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="org-latitude" label="Latitude (opcional)" hint="Entre -90 e 90." error={errors.latitude}>
            <input {...wire("latitude", true)} inputMode="decimal" placeholder="-12.2" />
          </Field>
          <Field id="org-longitude" label="Longitude (opcional)" hint="Entre -180 e 180." error={errors.longitude}>
            <input {...wire("longitude", true)} inputMode="decimal" placeholder="-38.97" />
          </Field>
        </div>
      </fieldset>

      <fieldset className="column gap-4">
        <legend className="mb-2 font-medium">Moderação</legend>
        <Field
          id="org-shadowBanThreshold"
          label="Limite de denúncias"
          hint="Quantas pessoas diferentes precisam denunciar um evento para ele ser ocultado e o autor entrar em shadow ban automaticamente."
          error={errors.shadowBanThreshold}
        >
          <input {...wire("shadowBanThreshold", true)} inputMode="numeric" className={`${wire("shadowBanThreshold").className} sm:max-w-40`} />
        </Field>
      </fieldset>

      {hasErrors && <ErrorAlert>Corrija os campos destacados antes de salvar.</ErrorAlert>}
      <ErrorAlert>{error}</ErrorAlert>
      <StatusMessage>{notice}</StatusMessage>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel !== undefined && (
          <button type="button" onClick={onCancel} disabled={saving} className="button clean min-h-10">Cancelar</button>
        )}
        <button type="submit" disabled={saving} className="button main min-h-10">
          {saving ? "Salvando..." : props.mode === "create" ? "Criar organização" : "Salvar alterações"}
        </button>
      </div>
    </form>
  );
}
