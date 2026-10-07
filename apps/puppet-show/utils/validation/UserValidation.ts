/* utils/validation/UserValidation.ts */

import { FormatPersonName } from "@/utils/text";

export const MIN_PASSWORD_LENGTH = 8;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type UserFormData = {
  name: string;
  email: string;
  password: string;
};

export type UserFormErrors = Partial<Record<keyof UserFormData | "confirmPassword", string>>;

export function NormalizeUser(raw: unknown): UserFormData {
  const body = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

  return {
    /* THE NAME IS ALWAYS SAVED AS "Maria Da Silva" */
    name: typeof body.name === "string" ? FormatPersonName(body.name) : "",
    email: typeof body.email === "string" ? body.email.trim().toLowerCase() : "",
    password: typeof body.password === "string" ? body.password : "",
  };
};

export function ValidateUser(data: UserFormData, { requireName }: { requireName: boolean }): UserFormErrors {
  const errors: UserFormErrors = {};

  if (requireName && data.name.length < 3)
    errors.name = "Informe seu nome completo";

  if (!EMAIL_REGEX.test(data.email))
    errors.email = "E-mail inválido";

  if (data.password.length < MIN_PASSWORD_LENGTH)
    errors.password = `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres`;

  return errors;
};
