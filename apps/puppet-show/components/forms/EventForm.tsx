/* components/forms/EventForm.tsx */

import { SyntheticEvent, useState } from "react";
import {
  HasEventErrors,
  ValidateEvent,
  type EventFormData,
  type EventFormErrors,
} from "@/utils/validation/EventValidation";
import { TodayInBrazil } from "@/utils/date";

export const EMPTY_EVENT: EventFormData = {
  title: "",
  description: "",
  location: "",
  date: "",
  time: "",
};

export type EventFormProps = {
  loading?: boolean;
  generalError?: string;
  onSubmit: (data: EventFormData) => Promise<void> | void;
};

export function EventForm({ loading = false, generalError = "", onSubmit }: EventFormProps) {
  const [event, setEvent] = useState<EventFormData>(EMPTY_EVENT);
  const [errors, setErrors] = useState<EventFormErrors>({});

  function update(field: keyof EventFormData, value: string) {
    setEvent((current) => ({ ...current, [field]: value }));

    if (errors[field])
      setErrors((current) => ({ ...current, [field]: undefined }));
  };

  async function handleSubmit(submitEvent: SyntheticEvent) {
    submitEvent.preventDefault();

    const newErrors = ValidateEvent(event);
    setErrors(newErrors);

    if (HasEventErrors(newErrors))
      return;

    await onSubmit(event);
  };

  return (
    <form onSubmit={handleSubmit} className="card column gap-4">
      <div className="column">
        <label htmlFor="title">Nome do evento</label>
        <input
          id="title"
          type="text"
          value={event.title}
          disabled={loading}
          onChange={(e) => update("title", e.target.value)}
          className={`input ${errors.title ? "input-error" : ""}`}
          placeholder="Feira de artesanato"
          maxLength={120}
        />
        {errors.title && <span className="error-message">{errors.title}</span>}
      </div>

      <div className="column">
        <label htmlFor="description">Descrição</label>
        <textarea
          id="description"
          value={event.description}
          disabled={loading}
          onChange={(e) => update("description", e.target.value)}
          className={`input min-h-32 resize-y ${errors.description ? "input-error" : ""}`}
          placeholder="Conte o que vai acontecer, quem pode participar e o que levar."
          maxLength={2000}
        />
        {errors.description && <span className="error-message">{errors.description}</span>}
      </div>

      <div className="column">
        <label htmlFor="location">Local</label>
        <input
          id="location"
          type="text"
          value={event.location}
          disabled={loading}
          onChange={(e) => update("location", e.target.value)}
          className={`input ${errors.location ? "input-error" : ""}`}
          placeholder="Praça da Matriz, Feira de Santana"
        />
        {errors.location && <span className="error-message">{errors.location}</span>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="column">
          <label htmlFor="date">Data</label>
          <input
            id="date"
            type="date"
            value={event.date}
            disabled={loading}
            /* THE BROWSER BLOCKS PAST DATES AND THE API CHECKS IT AGAIN */
            min={TodayInBrazil()}
            onChange={(e) => update("date", e.target.value)}
            className={`input ${errors.date ? "input-error" : ""}`}
          />
          {errors.date && <span className="error-message">{errors.date}</span>}
        </div>

        <div className="column">
          <label htmlFor="time">Horário</label>
          <input
            id="time"
            type="time"
            value={event.time}
            disabled={loading}
            onChange={(e) => update("time", e.target.value)}
            className={`input ${errors.time ? "input-error" : ""}`}
          />
          {errors.time && <span className="error-message">{errors.time}</span>}
        </div>
      </div>

      {generalError && <p className="error-message">{generalError}</p>}

      <button type="submit" disabled={loading} className="button main">
        {loading ? "Publicando..." : "Publicar evento"}
      </button>
    </form>
  );
};
