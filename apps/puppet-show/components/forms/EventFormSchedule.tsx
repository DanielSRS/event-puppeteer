/**
 * Step 2 of the event editor: the days the event happens on, each with an
 * optional start and end time.
 *
 * @module
 */

"use client";

import { MdAdd, MdDelete } from "react-icons/md";
import type { DayEntryForm, EventFormErrors } from "@/utils/validation/EventValidation";
import { FieldA11y, FieldError, FieldId } from "./EventFormField";

/** Props of {@link EventFormSchedule}. */
export type EventFormScheduleProps = {
  /** Prefix of every element id in the editor. */
  idPrefix: string;
  days: DayEntryForm[];
  /** Errors to show (only for steps the person already tried to leave). */
  errors: EventFormErrors;
  disabled: boolean;
  /** Today as `YYYY-MM-DD`; earlier dates can't be picked. */
  today: string;
  onChange: (days: DayEntryForm[]) => void;
  /** Adds an empty day at the end. */
  onAddDay: () => void;
};

/** The list of days with add/remove controls. */
export function EventFormSchedule({ idPrefix, days, errors, disabled, today, onChange, onAddDay }: EventFormScheduleProps) {
  const id = (path: string) => FieldId(idPrefix, path);
  const hint = id("days-hint");

  function update(index: number, patch: Partial<DayEntryForm>) {
    onChange(days.map((day, at) => (at === index ? { ...day, ...patch } : day)));
  }

  return (
    <div className="column gap-4">
      <p id={hint} className="text-sm text-foreground/80">
        Adicione um item para cada dia do evento. Sem horários, o evento dura o dia todo; o término só pode ser
        informado junto com o início.
      </p>

      <div id={id("days")} tabIndex={-1} className="column gap-1 outline-none">
        <FieldError fieldId={id("days")} error={errors.days} />
      </div>

      <ol className="column gap-3">
        {days.map((day, index) => {
          const at = `days.${index}`;
          const number = index + 1;
          return (
            <li key={day.key}>
              <fieldset className="column gap-3 rounded-xl border border-muted p-4 min-w-0">
                <legend className="px-1 text-sm font-semibold">Dia {number}</legend>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="column min-w-0">
                    <label htmlFor={id(`${at}.date`)}>Data</label>
                    <input
                      {...FieldA11y(id(`${at}.date`), errors[`${at}.date`], hint)}
                      type="date"
                      min={today}
                      value={day.date}
                      disabled={disabled}
                      onChange={(event) => update(index, { date: event.target.value })}
                      className={`input ${errors[`${at}.date`] ? "input-error" : ""}`}
                    />
                    <FieldError fieldId={id(`${at}.date`)} error={errors[`${at}.date`]} />
                  </div>

                  <div className="column min-w-0">
                    <label htmlFor={id(`${at}.startTime`)}>Início (opcional)</label>
                    <input
                      {...FieldA11y(id(`${at}.startTime`), errors[`${at}.startTime`])}
                      type="time"
                      value={day.startTime}
                      disabled={disabled}
                      onChange={(event) => update(index, { startTime: event.target.value })}
                      className={`input ${errors[`${at}.startTime`] ? "input-error" : ""}`}
                    />
                    <FieldError fieldId={id(`${at}.startTime`)} error={errors[`${at}.startTime`]} />
                  </div>

                  <div className="column min-w-0">
                    <label htmlFor={id(`${at}.endTime`)}>Término (opcional)</label>
                    <input
                      {...FieldA11y(id(`${at}.endTime`), errors[`${at}.endTime`])}
                      type="time"
                      value={day.endTime}
                      disabled={disabled}
                      onChange={(event) => update(index, { endTime: event.target.value })}
                      className={`input ${errors[`${at}.endTime`] ? "input-error" : ""}`}
                    />
                    <FieldError fieldId={id(`${at}.endTime`)} error={errors[`${at}.endTime`]} />
                  </div>
                </div>

                {days.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onChange(days.filter((_, at) => at !== index))}
                    disabled={disabled}
                    className="button clean self-start min-h-10 text-danger"
                  >
                    <MdDelete aria-hidden className="icon" /> Remover dia {number}
                  </button>
                )}
              </fieldset>
            </li>
          );
        })}
      </ol>

      <button type="button" onClick={onAddDay} disabled={disabled} className="button clean self-start min-h-10">
        <MdAdd aria-hidden className="icon" /> Adicionar dia
      </button>
    </div>
  );
}
