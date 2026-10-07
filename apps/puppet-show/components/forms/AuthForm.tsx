/* components/forms/AuthForm.tsx */

import { SyntheticEvent, useState } from "react";
import Link from "next/link";
import { MIN_PASSWORD_LENGTH } from "@/utils/validation/UserValidation";

export type AuthFormData = {
  name?: string;
  email: string;
  password: string;
};

type AuthFormProps = {
  mode: "login" | "register";
  loading?: boolean;
  generalError?: string;
  redirectPath?: string;
  onSubmit: (data: AuthFormData) => Promise<void> | void;
};

type FormErrors = {
  name?: string;
  email?: string;
  password?: string;
};

/* ONE FORM FOR THE TWO SCREENS: THE ONLY DIFFERENCE IS THE NAME FIELD */
export function AuthForm({ mode, loading = false, generalError = "", redirectPath = "/", onSubmit }: AuthFormProps) {
  const isRegister = mode === "register";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});

  function validate(): FormErrors {
    const newErrors: FormErrors = {};

    if (isRegister && name.trim().length < 3)
      newErrors.name = "Informe seu nome completo";

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      newErrors.email = "E-mail inválido";

    if (password.length < MIN_PASSWORD_LENGTH)
      newErrors.password = `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres`;

    return newErrors;
  };

  async function handleSubmit(event: SyntheticEvent) {
    event.preventDefault();

    const newErrors = validate();
    setErrors(newErrors);

    if (Object.values(newErrors).some(Boolean))
      return;

    await onSubmit({ name, email, password });
  };

  return (
    <form onSubmit={handleSubmit} className="card column gap-4 w-full max-w-md">
      <h1 className="title text-center">
        {isRegister ? "Criar conta" : "Entrar"}
      </h1>

      <p className="text-sm text-center opacity-70">
        {isRegister ? "Já tem conta?" : "Ainda não tem conta?"}{" "}
        <Link
          href={`${isRegister ? "/entrar" : "/cadastro"}${redirectPath !== "/" ? `?redirect=${encodeURIComponent(redirectPath)}` : ""}`}
          className="text-main underline"
        >
          {isRegister ? "Entrar" : "Criar conta"}
        </Link>
      </p>

      {isRegister && (
        <div className="column">
          <label htmlFor="name">Nome</label>
          <input
            id="name"
            type="text"
            value={name}
            disabled={loading}
            onChange={(e) => setName(e.target.value)}
            className={`input ${errors.name ? "input-error" : ""}`}
            placeholder="Seu nome completo"
          />
          {errors.name && <span className="error-message">{errors.name}</span>}
        </div>
      )}

      <div className="column">
        <label htmlFor="email">E-mail</label>
        <input
          id="email"
          type="email"
          value={email}
          disabled={loading}
          onChange={(e) => setEmail(e.target.value)}
          className={`input ${errors.email ? "input-error" : ""}`}
          placeholder="voce@email.com"
          autoComplete="email"
        />
        {errors.email && <span className="error-message">{errors.email}</span>}
      </div>

      <div className="column">
        <label htmlFor="password">Senha</label>
        <input
          id="password"
          type="password"
          value={password}
          disabled={loading}
          onChange={(e) => setPassword(e.target.value)}
          className={`input ${errors.password ? "input-error" : ""}`}
          placeholder="********"
          autoComplete={isRegister ? "new-password" : "current-password"}
        />
        {errors.password && <span className="error-message">{errors.password}</span>}
      </div>

      {generalError && <p className="error-message">{generalError}</p>}

      <button type="submit" disabled={loading} className="button main">
        {loading ? "Aguarde..." : isRegister ? "Criar conta" : "Entrar"}
      </button>
    </form>
  );
};
