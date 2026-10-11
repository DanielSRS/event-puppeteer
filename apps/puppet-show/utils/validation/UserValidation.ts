/**
 * Rules for the login and sign-up forms (the API enforces them too).
 *
 * @module
 */

/** Shortest password the API accepts. */
export const MIN_PASSWORD_LENGTH = 8;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** What the forms collect. `name` is only used on sign-up. */
export type UserFormData = {
  name: string;
  email: string;
  password: string;
};

/** Error message per field; a missing key means the field is fine. */
export type UserFormErrors = Partial<Record<keyof UserFormData, string>>;

/**
 * Checks the fields. Sign-up (`requireName`) needs a first and a last name,
 * since the API stores them separately.
 */
export function ValidateUser(data: UserFormData, { requireName }: { requireName: boolean }): UserFormErrors {
  const errors: UserFormErrors = {};

  if (requireName) {
    const words = data.name.trim().split(/\s+/).filter((word) => word.length > 0);
    if (words.length < 2) errors.name = "Informe seu nome e sobrenome.";
  }

  const emailError = ValidateEmail(data.email);
  if (emailError !== null) errors.email = emailError;

  if (data.password.length < MIN_PASSWORD_LENGTH)
    errors.password = `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`;

  return errors;
}

/** The error for an email field, or `null` when it holds an address. */
export function ValidateEmail(email: string): string | null {
  return EMAIL_REGEX.test(email.trim()) ? null : "Informe um e-mail válido.";
}

/** Errors of the "new password" form: the password and its repetition. */
export type NewPasswordErrors = Partial<Record<"password" | "confirmation", string>>;

/** Checks a new password and its confirmation (same rule as sign-up). */
export function ValidateNewPassword(password: string, confirmation: string): NewPasswordErrors {
  const errors: NewPasswordErrors = {};
  if (password.length < MIN_PASSWORD_LENGTH) errors.password = `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  if (confirmation !== password) errors.confirmation = "As senhas não são iguais.";
  return errors;
}

/**
 * Where to go after logging in. Only internal paths are accepted as
 * `?redirect=`, so a crafted link can't send people to another site; anything
 * else (or nothing) means the home page.
 */
export function SafeRedirect(raw: string | null): string {
  if (raw === null) return "/";
  return raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/\\") ? raw : "/";
}
