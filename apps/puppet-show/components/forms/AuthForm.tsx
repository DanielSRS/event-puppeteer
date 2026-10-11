/**
 * The login and sign-up form.
 *
 * @module
 */

"use client";

import { useId, useState, type FormEvent } from "react";
import Link from "next/link";
import { ErrorAlert, StatusMessage } from "@/components/ui/Feedback";
import { FormatPersonName } from "@/utils/text";
import { ValidateUser, type UserFormErrors } from "@/utils/validation/UserValidation";

/** What the form hands over on submit (email trimmed, name formatted). */
export type AuthFormData = {
  /** Full name; empty on login. */
  name: string;
  email: string;
  password: string;
};

export type AuthFormProps = {
  mode: "login" | "register";
  /** While the request runs. */
  loading?: boolean;
  /** Why the last attempt failed. */
  generalError?: string;
  /** Good news above the fields, e.g. "E-mail confirmado". */
  notice?: string;
  /** Path kept across the login ↔ sign-up links. */
  redirectPath?: string;
  /** Offered when the account waits for email confirmation. */
  onResendVerification?: () => void;
  resending?: boolean;
  /** Why resending the confirmation failed. */
  resendError?: string;
  onSubmit: (data: AuthFormData) => Promise<void> | void;
};

/** One form for the two screens: sign-up adds the name field. Each field shows its own error. */
export function AuthForm({
  mode,
  loading = false,
  generalError = "",
  notice = "",
  redirectPath = "/",
  onResendVerification,
  resending = false,
  resendError = "",
  onSubmit,
}: AuthFormProps) {
  const isRegister = mode === "register";
  const ids = { name: useId(), email: useId(), password: useId() };

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<UserFormErrors>({});

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const found = ValidateUser({ name, email, password }, { requireName: isRegister });
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    await onSubmit({ name: isRegister ? FormatPersonName(name) : "", email: email.trim(), password });
  }

  const other = isRegister ? "/entrar" : "/cadastro";
  const otherHref = redirectPath === "/" ? other : `${other}?redirect=${encodeURIComponent(redirectPath)}`;

  const field = (
    key: "name" | "email" | "password",
    label: string,
    input: { type: string; value: string; onChange: (value: string) => void; autoComplete: string; placeholder: string },
  ) => (
    <div className="column">
      <label htmlFor={ids[key]}>{label}</label>
      <input
        id={ids[key]}
        type={input.type}
        value={input.value}
        disabled={loading}
        onChange={(event) => input.onChange(event.target.value)}
        className={`input min-h-11 ${errors[key] ? "input-error" : ""}`}
        placeholder={input.placeholder}
        autoComplete={input.autoComplete}
        aria-invalid={errors[key] !== undefined}
        aria-describedby={errors[key] !== undefined ? `${ids[key]}-error` : undefined}
      />
      {errors[key] !== undefined && <span id={`${ids[key]}-error`} className="error-message">{errors[key]}</span>}
    </div>
  );

  return (
    <form onSubmit={handleSubmit} noValidate className="card column gap-4 w-full max-w-md">
      <h1 className="title text-center">{isRegister ? "Criar conta" : "Entrar"}</h1>

      <p className="text-sm text-center text-foreground/80">
        {isRegister ? "Já tem conta?" : "Ainda não tem conta?"}{" "}
        <Link href={otherHref} className="text-main underline">
          {isRegister ? "Entrar" : "Criar conta"}
        </Link>
      </p>

      <StatusMessage>{notice}</StatusMessage>

      {isRegister && field("name", "Nome completo", { type: "text", value: name, onChange: setName, autoComplete: "name", placeholder: "Maria Souza" })}
      {field("email", "E-mail", { type: "email", value: email, onChange: setEmail, autoComplete: "email", placeholder: "voce@email.com" })}
      {field("password", "Senha", {
        type: "password",
        value: password,
        onChange: setPassword,
        autoComplete: isRegister ? "new-password" : "current-password",
        placeholder: "********",
      })}

      {!isRegister && (
        <Link href="/esqueci-senha" className="-mt-2 self-end text-sm text-main underline">
          Esqueci minha senha
        </Link>
      )}

      <ErrorAlert>{generalError}</ErrorAlert>
      <ErrorAlert>{resendError}</ErrorAlert>

      {onResendVerification !== undefined && (
        <button type="button" onClick={onResendVerification} disabled={resending} className="button clean touch">
          {resending ? "Enviando..." : "Reenviar e-mail de confirmação"}
        </button>
      )}

      <button type="submit" disabled={loading} className="button main touch">
        {loading ? "Aguarde..." : isRegister ? "Criar conta" : "Entrar"}
      </button>
    </form>
  );
}
