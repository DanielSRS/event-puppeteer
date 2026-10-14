/**
 * Form with every organization field the API accepts: name, identifier
 * (slug), description, site, colour, location, coordinates and the report
 * threshold. Used to create and edit organizations (Superadmin, inside a side
 * panel) and by an Admin to edit their own organization (without the slug).
 * The logo is an uploaded Image, managed apart (see `LogoPanel`).
 *
 * The fields come in four groups (Identificação, Aparência e site,
 * Localização, Moderação). With `layout="cards"` (the settings page) each
 * group is a glass card and the buttons sit in a sticky bar at the bottom;
 * the default `"plain"` layout (the side panel) separates the groups with
 * lines. The colour field shows a swatch and previews of both themes; the
 * threshold has −/+ buttons. The bar counts the fields changed and not saved.
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
import { DEFAULT_ORG_COLOR } from "@/lib/theme/theme";
import {
  EmptyOrganizationForm, OrganizationChanges, OrganizationToForm, ToSlug, ValidateOrganizationForm,
  type OrganizationFormErrors, type OrganizationFormField, type OrganizationFormValues,
} from "./organization-form-values";
import { ThemePreview } from "./theme-preview";

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
  /** `"cards"`: each group in a glass card and a sticky action bar (settings page). Default `"plain"` (side panel). */
  layout?: "plain" | "cards";
};

export type OrganizationFormProps = CommonProps & (
  | { mode: "create"; onCreate: (body: OrganizationInput) => void }
  | { mode: "edit"; original: Organization; onUpdate: (changes: Partial<OrganizationInput>) => void }
);

/** Label style shared by every field (the design's `.field-label`). */
const LABEL = "mb-0 text-[13px] text-[color:var(--fg-2)]";

/** Hint style (the design's `.hint`). */
const HINT = "t3 text-[12.5px]";

/** One labelled field with its hint and error. */
function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div className="column gap-1.5">
      <label htmlFor={id} className={LABEL}>{label}</label>
      {children}
      {hint !== undefined && <p id={`${id}-hint`} className={HINT}>{hint}</p>}
      {error !== undefined && <p id={`${id}-error`} className="error-message">{error}</p>}
    </div>
  );
}

/** A group of fields: a glass card or a section under a line, with the legend as its title. */
function Group({ legend, cards, children }: { legend: string; cards: boolean; children: ReactNode }) {
  const frame = cards
    ? "glass rounded-[24px] p-[22px]"
    : "border-t border-[color:var(--line)] pt-5 first:border-t-0 first:pt-0";
  return (
    <fieldset className={`column m-0 min-w-0 gap-3.5 ${frame}`}>
      <legend className="h2 float-left mb-1 w-full p-0 text-[19px]">{legend}</legend>
      {children}
    </fieldset>
  );
}

/** Number of fields whose value differs from `initial`. */
function ChangedCount(values: OrganizationFormValues, initial: OrganizationFormValues): number {
  return (Object.keys(initial) as OrganizationFormField[]).filter((field) => values[field].trim() !== initial[field].trim()).length;
}

/** The organization form. */
export function OrganizationForm(props: OrganizationFormProps) {
  const { saving, error, takenSlugs, slugEditable, onCancel, layout = "plain" } = props;
  const cards = layout === "cards";
  const [initial] = useState<OrganizationFormValues>(
    () => props.mode === "edit" ? OrganizationToForm(props.original) : EmptyOrganizationForm(),
  );
  const [values, setValues] = useState<OrganizationFormValues>(initial);
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
      className: `input ${errors[field] !== undefined ? "input-error" : ""}`,
    };
  };

  /** Moves the threshold one step, never below 1. */
  const stepThreshold = (delta: number) => {
    const current = Number.parseInt(values.shadowBanThreshold, 10);
    const next = Number.isNaN(current) ? 1 : Math.max(1, current + delta);
    update("shadowBanThreshold", String(next));
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
  const typedColor = values.colorScheme.trim();
  const swatch = /^#[0-9a-fA-F]{6}$/.test(typedColor) ? typedColor : null;
  const changed = props.mode === "edit" ? ChangedCount(values, initial) : 0;
  const thresholdError = errors.shadowBanThreshold !== undefined;
  const threshold = wire("shadowBanThreshold", true);
  const color = wire("colorScheme", true);

  return (
    <form onSubmit={handleSubmit} noValidate aria-label="Dados da organização" className={`column ${cards ? "gap-3.5" : "gap-5"}`}>
      <Group legend="Identificação" cards={cards}>
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
          <p className="mono t3 text-[12.5px]">
            Identificador: <span>{values.slug}</span>
          </p>
        )}

        <Field id="org-description" label="Descrição (opcional)" error={errors.description}>
          <textarea {...wire("description")} rows={3} className={`${wire("description").className} resize-y py-3`} />
        </Field>
      </Group>

      <Group legend="Aparência e site" cards={cards}>
        <Field id="org-url" label="Site (opcional)" hint="Endereço completo, começando com https://." error={errors.url}>
          <input {...wire("url", true)} type="url" inputMode="url" placeholder="https://..." />
        </Field>
        <Field
          id="org-colorScheme"
          label="Cor principal (opcional)"
          hint="Formato #rrggbb. Dela saem o acento, os gradientes de fundo e os tons dos temas claro e escuro."
          error={errors.colorScheme}
        >
          <span className={`input row w-auto max-w-full gap-2.5 self-start pl-2 pr-3.5 focus-within:border-main ${errors.colorScheme !== undefined ? "input-error" : ""}`}>
            <span
              aria-hidden
              className="h-8 w-8 shrink-0 rounded-[10px] shadow-[inset_0_0_0_1px_var(--line-2)]"
              style={{ background: swatch ?? "var(--surface-2)" }}
            />
            <input
              {...color}
              className="mono w-28 min-w-0 bg-transparent text-sm text-foreground outline-none placeholder:text-[color:var(--fg-3)]"
              placeholder="#2563eb"
              spellCheck={false}
            />
          </span>
        </Field>
        <ThemePreview color={swatch ?? DEFAULT_ORG_COLOR} />
      </Group>

      <Group legend="Localização" cards={cards}>
        <Field id="org-location" label="Local (opcional)" error={errors.location}>
          <input {...wire("location")} placeholder="Ex.: Feira de Santana, BA" />
        </Field>
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(180px,100%),1fr))]">
          <Field id="org-latitude" label="Latitude (opcional)" hint="Entre -90 e 90." error={errors.latitude}>
            <input {...wire("latitude", true)} inputMode="decimal" placeholder="-12.2" className={`${wire("latitude").className} font-mono`} />
          </Field>
          <Field id="org-longitude" label="Longitude (opcional)" hint="Entre -180 e 180." error={errors.longitude}>
            <input {...wire("longitude", true)} inputMode="decimal" placeholder="-38.97" className={`${wire("longitude").className} font-mono`} />
          </Field>
        </div>
      </Group>

      <Group legend="Moderação" cards={cards}>
        <div className="flex flex-wrap items-center gap-x-[18px] gap-y-2">
          <div className="column gap-1.5">
            <label htmlFor="org-shadowBanThreshold" className={LABEL}>Limite de denúncias</label>
            <span className={`input row w-auto self-start overflow-hidden p-0 focus-within:border-main ${thresholdError ? "input-error" : ""}`}>
              <button type="button" onClick={() => stepThreshold(-1)} aria-label="Diminuir limite" className="button ghost icon-only min-h-12 rounded-none border-0 text-xl">−</button>
              <input
                {...threshold}
                inputMode="numeric"
                className="h-12 w-14 bg-transparent text-center font-display text-[22px] font-bold text-foreground outline-none"
              />
              <button type="button" onClick={() => stepThreshold(1)} aria-label="Aumentar limite" className="button ghost icon-only min-h-12 rounded-none border-0 text-xl">+</button>
            </span>
          </div>
          <p id="org-shadowBanThreshold-hint" className="t2 min-w-0 flex-[1_1_240px] text-sm">
            Quantas pessoas diferentes precisam denunciar um evento para ele ser ocultado e o autor entrar em shadow ban automaticamente.
          </p>
        </div>
        {errors.shadowBanThreshold !== undefined && <p id="org-shadowBanThreshold-error" className="error-message">{errors.shadowBanThreshold}</p>}
      </Group>

      {hasErrors && <ErrorAlert>Corrija os campos destacados antes de salvar.</ErrorAlert>}
      <ErrorAlert>{error}</ErrorAlert>
      <StatusMessage>{notice}</StatusMessage>

      <div
        className={cards
          ? "glass-strong sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-[20px] py-3 pl-[18px] pr-3"
          : "flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--line)] pt-4"}
      >
        <span className="t2 text-sm">
          {changed === 0 ? "" : changed === 1 ? "1 alteração não salva" : `${changed} alterações não salvas`}
        </span>
        <div className="flex flex-1 flex-col-reverse gap-2 sm:flex-none sm:flex-row">
          {onCancel !== undefined && (
            <button type="button" onClick={onCancel} disabled={saving} className="button ghost">Cancelar</button>
          )}
          <button type="submit" disabled={saving} className="button main">
            {saving ? "Salvando..." : props.mode === "create" ? "Criar organização" : "Salvar alterações"}
          </button>
        </div>
      </div>
    </form>
  );
}
