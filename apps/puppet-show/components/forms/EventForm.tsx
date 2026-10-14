/**
 * The event editor: the one form used to create an event, both in the
 * dashboard (Meus Eventos) and on `/eventos/novo`.
 *
 * Three steps (Informações, Programação, Tags, links e banner). Each step's
 * heading reads "Etapa N de 3" above the question it answers, followed by a
 * progress bar; Voltar/Cancelar and Avançar/Publicar stay pinned at the
 * bottom while the step scrolls. Leaving a step
 * checks its fields; publishing checks everything and lists what is wrong in a
 * summary whose entries take the person to the field. Every error sits next to
 * its control (`aria-invalid` + `aria-describedby`). The component is
 * presentational: catalogs come in as props and the side effects (create a
 * tag, read the device position, send the event) are callbacks.
 *
 * @module
 */

"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { MdArrowForward } from "react-icons/md";
import { ErrorAlert } from "@/components/ui/Feedback";
import type { CreateEventInput, LinkLabel, Tag } from "@/lib/api/schemas";
import type { Result } from "@/lib/result";
import {
  ErrorsOfStep, EVENT_FORM_STEPS, HasEventErrors, StepOfField, ToCreateEventInput, ValidateEvent,
  type EventFormData, type EventFormErrors,
} from "@/utils/validation/EventValidation";
import { EventFormBasics, type Coordinates } from "./EventFormBasics";
import { FieldId } from "./EventFormField";
import { EventFormMedia } from "./EventFormMedia";
import { EventFormSchedule } from "./EventFormSchedule";

/** Props of {@link EventForm}. */
export type EventFormProps = {
  /** Every tag known to the system (`GET /tags`). */
  tags: Tag[];
  /** Labels a link can have (`GET /link-labels`). */
  linkLabels: LinkLabel[];
  /** Today as `YYYY-MM-DD` in Brazil; dates before it are rejected. */
  today: string;
  /** While true the form is locked and the publish button says it's working. */
  busy: boolean;
  /** Why the last attempt to publish failed. */
  generalError: string;
  /**
   * Receives the request body once every rule passes, with the cropped banner to upload
   * once the event exists (`null` for none).
   */
  onSubmit: (input: CreateEventInput, banner: Blob | null) => void;
  /** Shows a "Cancelar" button on the first step when given. */
  onCancel?: () => void;
  /** Creates (or finds) a free-form tag by name. */
  onCreateTag: (name: string) => Promise<Result<Tag, string>>;
  /** Reads the device position. */
  onLocate: () => Promise<Result<Coordinates, string>>;
};

/** What each step is called in the progress bar, and the question its heading asks. */
const STEP_TEXT: Record<(typeof EVENT_FORM_STEPS)[number], { label: string; question: string }> = {
  "Informações": { label: "Informações", question: "O que vai acontecer?" },
  "Data e horário": { label: "Programação", question: "Quando acontece?" },
  "Mídia e links": { label: "Tags, links e banner", question: "Últimos detalhes" },
};

/** Labels of the error summary entries, by field. */
function FieldLabel(path: string): string {
  const day = /^days\.(\d+)\.(\w+)$/.exec(path);
  if (day !== null) {
    const parts: Record<string, string> = { date: "data", startTime: "início", endTime: "término" };
    const part = parts[day[2]];
    return `Dia ${Number(day[1]) + 1}: ${part}`;
  }
  const link = /^links\.(\d+)\.(\w+)$/.exec(path);
  if (link !== null) return `Link ${Number(link[1]) + 1}: ${link[2] === "url" ? "endereço" : "tipo"}`;

  const names: Record<string, string> = {
    title: "Nome do evento",
    description: "Descrição",
    location: "Local",
    latitude: "Latitude",
    longitude: "Longitude",
    days: "Programação",
  };
  return names[path];
}

/** A step-by-step editor that produces a `CreateEventInput`. */
export function EventForm({
  tags, linkLabels, today, busy, generalError, onSubmit, onCancel, onCreateTag, onLocate,
}: EventFormProps) {
  const idPrefix = useId();
  const nextKey = useRef(1);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);

  const [data, setData] = useState<EventFormData>({
    title: "",
    description: "",
    location: "",
    latitude: "",
    longitude: "",
    days: [{ key: "day-0", date: "", startTime: "", endTime: "" }],
    tags: [],
    links: [],
    banner: null,
  });
  const [step, setStep] = useState(0);
  const [checkedSteps, setCheckedSteps] = useState<ReadonlySet<number>>(new Set());
  const [showSummary, setShowSummary] = useState(false);
  const focusTarget = useRef<"heading" | "summary" | string | null>(null);
  const [focusRequest, setFocusRequest] = useState(0);

  const allErrors = ValidateEvent(data, today);
  const shownErrors: EventFormErrors = Object.fromEntries(
    Object.entries(allErrors).filter(([path]) => checkedSteps.has(StepOfField(path))),
  );
  const isLast = step === EVENT_FORM_STEPS.length - 1;

  useEffect(() => {
    const target = focusTarget.current;
    if (target === null) return;
    focusTarget.current = null;
    if (target === "heading") headingRef.current?.focus();
    else if (target === "summary") summaryRef.current?.focus();
    else document.getElementById(FieldId(idPrefix, target))?.focus();
  }, [focusRequest, idPrefix]);

  /** Moves focus to `target` once the next render is on screen. */
  function setFocusTarget(target: "heading" | "summary" | string) {
    focusTarget.current = target;
    setFocusRequest((count) => count + 1);
  }

  function change(patch: Partial<EventFormData>) {
    setData((current) => ({ ...current, ...patch }));
  }

  function newKey(kind: string): string {
    const key = `${kind}-${nextKey.current}`;
    nextKey.current += 1;
    return key;
  }

  function goTo(target: number) {
    setStep(target);
    setFocusTarget("heading");
  }

  function advance() {
    setCheckedSteps((current) => new Set(current).add(step));
    const stepErrors = ErrorsOfStep(allErrors, step);
    if (HasEventErrors(stepErrors)) {
      setFocusTarget(Object.keys(stepErrors)[0]);
      return;
    }
    goTo(step + 1);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!isLast) {
      advance();
      return;
    }
    setCheckedSteps(new Set(EVENT_FORM_STEPS.keys()));
    if (HasEventErrors(allErrors)) {
      setShowSummary(true);
      setFocusTarget("summary");
      return;
    }
    setShowSummary(false);
    onSubmit(ToCreateEventInput(data), data.banner);
  }

  function jumpToField(path: string) {
    setStep(StepOfField(path));
    setFocusTarget(path);
  }

  const summaryEntries = Object.entries(allErrors);
  const stepText = STEP_TEXT[EVENT_FORM_STEPS[step]];
  const stepCount = EVENT_FORM_STEPS.length;

  return (
    <form onSubmit={handleSubmit} noValidate className="column gap-5" aria-label="Editor de evento">
      <section aria-labelledby={`${idPrefix}-step-heading`} className="column gap-5">
        <h2 id={`${idPrefix}-step-heading`} ref={headingRef} tabIndex={-1} className="column gap-1 outline-none">
          <span className="sr-only">Etapa {step + 1} de {stepCount}: {stepText.label}. </span>
          <span aria-hidden className="caption">Etapa {step + 1} de {stepCount} · {stepText.label}</span>
          <span className="h1 text-[26px] leading-[1.05] md:text-[30px]">{stepText.question}</span>
        </h2>

        <ol className="grid grid-cols-3 gap-2" aria-label="Etapas">
          {EVENT_FORM_STEPS.map((name, index) => (
            <li key={name} aria-current={index === step ? "step" : undefined} className="column gap-2">
              <span
                aria-hidden
                className="h-1 rounded-full"
                style={{
                  background: index < step
                    ? "var(--accent-ink)"
                    : index === step
                      ? "linear-gradient(90deg, var(--accent-ink) 50%, var(--surface-2) 50%)"
                      : "var(--surface-2)",
                }}
              />
              <span className={`text-xs ${index === step ? "font-semibold" : index < step ? "text-fg-2" : "text-fg-3"}`}>
                {STEP_TEXT[name].label}
              </span>
            </li>
          ))}
        </ol>

        {showSummary && HasEventErrors(allErrors) && (
          <div ref={summaryRef} tabIndex={-1} role="alert" className="notice n-bad flex-col items-stretch gap-2 outline-none focus-visible:ring-2 focus-visible:ring-danger">
            <h2 className="text-sm font-semibold">Corrija {summaryEntries.length === 1 ? "o campo" : `os ${summaryEntries.length} campos`} abaixo antes de publicar:</h2>
            <ul className="column gap-0.5 text-sm">
              {summaryEntries.map(([path, message]) => (
                <li key={path}>
                  <button type="button" onClick={() => jumpToField(path)} className="min-h-11 rounded-lg text-left underline focus-ring">
                    {FieldLabel(path)}: {message}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {step === 0 && (
          <EventFormBasics idPrefix={idPrefix} data={data} errors={shownErrors} disabled={busy} onChange={change} onLocate={onLocate} />
        )}
        {step === 1 && (
          <EventFormSchedule
            idPrefix={idPrefix}
            days={data.days}
            errors={shownErrors}
            disabled={busy}
            today={today}
            title={data.title}
            onChange={(days) => change({ days })}
            onAddDay={() => change({ days: [...data.days, { key: newKey("day"), date: "", startTime: "", endTime: "" }] })}
          />
        )}
        {step === 2 && (
          <EventFormMedia
            idPrefix={idPrefix}
            data={data}
            errors={shownErrors}
            disabled={busy}
            tags={tags}
            linkLabels={linkLabels}
            onChange={change}
            onAddLink={() => change({ links: [...data.links, { key: newKey("link"), labelId: "", url: "" }] })}
            onCreateTag={onCreateTag}
          />
        )}
      </section>

      <ErrorAlert>{generalError}</ErrorAlert>

      <div className="sticky -bottom-5 z-10 between gap-3 border-t border-line bg-[var(--glass-strong)] pb-5 pt-4 backdrop-blur-xl">
        {step > 0 ? (
          <button type="button" onClick={() => goTo(step - 1)} disabled={busy} className="button min-h-12 px-5">
            Voltar
          </button>
        ) : onCancel !== undefined ? (
          <button type="button" onClick={onCancel} disabled={busy} className="button min-h-12 px-5">
            Cancelar
          </button>
        ) : (
          <span />
        )}
        <button type="submit" disabled={busy} className="button main min-h-12 px-[22px] text-[15px]">
          {isLast ? (busy ? "Publicando..." : "Publicar evento") : "Avançar"}
          <MdArrowForward aria-hidden className="h-[18px] w-[18px]" />
        </button>
      </div>
    </form>
  );
}
