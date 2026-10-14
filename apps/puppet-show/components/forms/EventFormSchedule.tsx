/**
 * Step 2 of the event editor: the days the event happens on, each with an
 * optional start and end time, in its own box (outlined in red while one of
 * its fields is wrong). Below the days, a preview of the event's line in the
 * mural (date badge, title, weekday, times and how many days).
 *
 * @module
 */

"use client";

import { MdAdd, MdDeleteOutline } from "react-icons/md";
import { DateBadge, MultiDayLabel, SortedDays, TimeRange, type ScheduleDay } from "@/domain/schedule";
import type { DayEntryForm, EventFormErrors } from "@/utils/validation/EventValidation";
import {
  FIELD, FIELD_BOX, FIELD_BOX_LEGEND, FIELD_LABEL, FieldA11y, FieldBoxBorder, FieldError, FieldId,
} from "./EventFormField";

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
  /** The event's name, shown in the mural preview. */
  title?: string;
};

/** A `YYYY-MM-DD` date. */
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A `HH:MM` time. */
const TIME = /^\d{2}:\d{2}$/;

/** The days with a date as the schedule helpers read them (times only when complete). */
function PreviewDays(days: DayEntryForm[]): ScheduleDay[] {
  return days
    .filter((day) => DATE.test(day.date))
    .map((day) => {
      const start = TIME.test(day.startTime) ? { startTime: day.startTime } : {};
      const end = TIME.test(day.startTime) && TIME.test(day.endTime) ? { endTime: day.endTime } : {};
      return { date: day.date, ...start, ...end };
    });
}

/** `"2026-10-17"` → `"Sáb"`. */
function ShortWeekday(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const name = new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("pt-BR", { weekday: "short", timeZone: "UTC" });
  const bare = name.replace(".", "");
  return bare.charAt(0).toLocaleUpperCase("pt-BR") + bare.slice(1);
}

/** How the event will look in the mural, from its first dated day. Nothing until a day has a date. */
function MuralPreview({ days, title }: { days: DayEntryForm[]; title: string }) {
  const dated = SortedDays(PreviewDays(days));
  const first = dated[0];
  if (first === undefined) return null;
  const badge = DateBadge(first.date);
  const span = MultiDayLabel(dated);
  const details = [ShortWeekday(first.date), TimeRange(first), span].filter((part) => part !== null).join(" · ");

  return (
    <div className="column mt-2 gap-2.5">
      <span className="caption">Como vai aparecer no mural</span>
      <div className="surface row gap-3.5 rounded-[20px] border border-line p-2.5">
        {badge !== null && (
          <span aria-hidden className="surface-2 column w-[58px] shrink-0 items-center rounded-[14px] pb-[7px] pt-2 leading-none">
            <span className="font-display text-[22px] font-bold">{badge.day}</span>
            <span className="mt-1 font-mono text-[11px] uppercase text-fg-2">{badge.month}</span>
          </span>
        )}
        <span className="column min-w-0">
          <span className="truncate text-[15px] font-semibold">{title.trim() === "" ? "Seu evento" : title.trim()}</span>
          <span className="text-[13px] text-fg-2">{details}</span>
        </span>
      </div>
    </div>
  );
}

/** The list of days with add/remove controls. */
export function EventFormSchedule({ idPrefix, days, errors, disabled, today, onChange, onAddDay, title = "" }: EventFormScheduleProps) {
  const id = (path: string) => FieldId(idPrefix, path);
  const hint = id("days-hint");

  function update(index: number, patch: Partial<DayEntryForm>) {
    onChange(days.map((day, at) => (at === index ? { ...day, ...patch } : day)));
  }

  return (
    <div className="column gap-3.5">
      <p id={hint} className="text-[15px] text-fg-2">
        Adicione um item para cada dia do evento. Sem horários, o evento dura o dia todo; o término só pode ser
        informado junto com o início.
      </p>

      <div id={id("days")} tabIndex={-1} className="column gap-1 outline-none">
        <FieldError fieldId={id("days")} error={errors.days} />
      </div>

      <ol className="column gap-3.5">
        {days.map((day, index) => {
          const at = `days.${index}`;
          const number = index + 1;
          const invalid = [`${at}.date`, `${at}.startTime`, `${at}.endTime`].some((path) => errors[path] !== undefined);
          return (
            <li key={day.key}>
              <fieldset className={`${FIELD_BOX} ${FieldBoxBorder(invalid)}`}>
                <legend className={FIELD_BOX_LEGEND}>Dia {number}</legend>

                <div className="flex flex-wrap items-start gap-2.5">
                  <div className={`${FIELD} flex-[2_1_160px]`}>
                    <label htmlFor={id(`${at}.date`)} className={FIELD_LABEL}>Data</label>
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

                  <div className={`${FIELD} flex-[1_1_120px]`}>
                    <label htmlFor={id(`${at}.startTime`)} className={FIELD_LABEL}>Início (opcional)</label>
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

                  <div className={`${FIELD} flex-[1_1_120px]`}>
                    <label htmlFor={id(`${at}.endTime`)} className={FIELD_LABEL}>Término (opcional)</label>
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
                    className="button ghost self-start text-fg-2"
                  >
                    <MdDeleteOutline aria-hidden className="h-4 w-4" /> Remover dia {number}
                  </button>
                )}
              </fieldset>
            </li>
          );
        })}
      </ol>

      <button
        type="button"
        onClick={onAddDay}
        disabled={disabled}
        className="button min-h-[52px] rounded-[18px] border-dashed bg-transparent"
      >
        <MdAdd aria-hidden className="h-[18px] w-[18px]" /> Adicionar dia
      </button>

      <MuralPreview days={days} title={title} />
    </div>
  );
}
