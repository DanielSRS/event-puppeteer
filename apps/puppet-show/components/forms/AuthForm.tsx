/**
 * The login and sign-up form.
 *
 * @module
 */

"use client";

import { useId, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { ErrorAlert, StatusMessage } from "@/components/ui/Feedback";
import { FormatPersonName } from "@/utils/text";
import { ValidateUser, type UserFormErrors } from "@/utils/validation/UserValidation";
import {
  AUTH_CARD, AUTH_CARD_BASE, AUTH_FIELD, AUTH_FIELD_ERROR, AUTH_INPUT, AUTH_LABEL, AUTH_SUBMIT, AUTH_SUBMIT_LARGE,
  AUTH_TITLE, AUTH_TITLE_LARGE,
} from "./auth-styles";

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

/**
 * One form for the two screens: sign-up adds the name field. Each field shows its own error.
 * Drawn as a glass card; login offers "Criar conta" under an "ou" divider, sign-up links back to login.
 */
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
    aside?: ReactNode,
  ) => (
    <div className={AUTH_FIELD}>
      {aside === undefined ? (
        <label htmlFor={ids[key]} className={AUTH_LABEL}>{label}</label>
      ) : (
        <div className="between gap-3">
          <label htmlFor={ids[key]} className={AUTH_LABEL}>{label}</label>
          {aside}
        </div>
      )}
      <input
        id={ids[key]}
        type={input.type}
        value={input.value}
        disabled={loading}
        onChange={(event) => input.onChange(event.target.value)}
        className={`${AUTH_INPUT} ${errors[key] ? "input-error" : ""}`}
        placeholder={input.placeholder}
        autoComplete={input.autoComplete}
        aria-invalid={errors[key] !== undefined}
        aria-describedby={errors[key] !== undefined ? `${ids[key]}-error` : undefined}
      />
      {errors[key] !== undefined && <span id={`${ids[key]}-error`} className={AUTH_FIELD_ERROR}>{errors[key]}</span>}
    </div>
  );

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className={isRegister ? AUTH_CARD : `${AUTH_CARD_BASE} gap-5 rounded-[30px] p-6 sm:rounded-[32px] sm:p-8`}
    >
      <div className="column gap-1.5">
        <h1 className={isRegister ? AUTH_TITLE : AUTH_TITLE_LARGE}>{isRegister ? "Criar conta" : "Entrar"}</h1>
        <p className="t2">
          {isRegister
            ? "Com a conta você entra no mural e já pode publicar eventos."
            : "Use o e-mail com que você se cadastrou."}
        </p>
      </div>

      <StatusMessage>{notice}</StatusMessage>

      {isRegister && field("name", "Nome completo", { type: "text", value: name, onChange: setName, autoComplete: "name", placeholder: "Maria Souza" })}
      {field("email", "E-mail", { type: "email", value: email, onChange: setEmail, autoComplete: "email", placeholder: "voce@email.com" })}
      {field(
        "password",
        "Senha",
        {
          type: "password",
          value: password,
          onChange: setPassword,
          autoComplete: isRegister ? "new-password" : "current-password",
          placeholder: "********",
        },
        isRegister ? undefined : (
          <Link
            href="/esqueci-senha"
            className="-my-3 inline-flex min-h-11 items-center rounded-lg text-sm font-semibold text-main focus-ring"
          >
            Esqueci minha senha
          </Link>
        ),
      )}

      <ErrorAlert>{generalError}</ErrorAlert>
      <ErrorAlert>{resendError}</ErrorAlert>

      {onResendVerification !== undefined && (
        <button type="button" onClick={onResendVerification} disabled={resending} className="button min-h-12 rounded-2xl">
          {resending ? "Enviando..." : "Reenviar e-mail de confirmação"}
        </button>
      )}

      <button
        type="submit"
        disabled={loading}
        className={isRegister ? AUTH_SUBMIT : AUTH_SUBMIT_LARGE}
      >
        {loading ? "Aguarde..." : isRegister ? "Criar conta" : "Entrar"}
      </button>

      {isRegister ? (
        <p className="t2 text-center text-sm">
          Já tem conta?{" "}
          <Link href={otherHref} className="inline-flex min-h-11 items-center rounded-lg font-semibold text-main focus-ring">
            Entrar
          </Link>
        </p>
      ) : (
        <>
          <div aria-hidden className="row gap-3 text-[13px] t3">
            <span className="h-px flex-1 bg-[var(--line-2)]" />
            ou
            <span className="h-px flex-1 bg-[var(--line-2)]" />
          </div>
          <Link href={otherHref} className="button min-h-[52px] rounded-2xl focus-ring">
            Criar conta
          </Link>
        </>
      )}
    </form>
  );
}
