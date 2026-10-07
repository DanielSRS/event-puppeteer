/* utils/validation/EventValidation.ts */

/* EVENT RULES USED BY THE FORM AND BY THE API */

import { IsPastDate } from "@/utils/date";

export type EventFormData = {
  title: string;
  description: string;
  location: string;
  date: string;
  time: string;
};

export type EventFormErrors = Partial<Record<keyof EventFormData, string>>;

export function NormalizeEvent(raw: unknown): EventFormData {
  const body = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const text = (key: keyof EventFormData) => (typeof body[key] === "string" ? (body[key] as string).trim() : "");

  return {
    title: text("title"),
    description: text("description"),
    location: text("location"),
    date: text("date"),
    time: text("time"),
  };
};

export function ValidateEvent(data: EventFormData): EventFormErrors {
  const errors: EventFormErrors = {};

  if (data.title.length < 3)
    errors.title = "Informe um nome com pelo menos 3 letras";

  else if (data.title.length > 120)
    errors.title = "Nome muito longo";

  if (data.description.length < 10)
    errors.description = "Conte um pouco mais sobre o evento";

  else if (data.description.length > 2000)
    errors.description = "Descrição muito longa";

  if (data.location.length < 3)
    errors.location = "Informe onde o evento acontece";

  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date))
    errors.date = "Escolha a data";

  else if (IsPastDate(data.date))
    errors.date = "A data não pode ser anterior a hoje";

  if (!/^\d{2}:\d{2}$/.test(data.time))
    errors.time = "Escolha o horário";

  return errors;
};

export function HasEventErrors(errors: EventFormErrors): boolean {
  return Object.values(errors).some(Boolean);
};
