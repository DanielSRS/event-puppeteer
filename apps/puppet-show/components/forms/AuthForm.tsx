/* components/forms/AuthForm.tsx */

"use client";

import { SyntheticEvent, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { NotifyAuthChange } from "@/hooks/useAuth";
import { MIN_PASSWORD_LENGTH } from "@/utils/validation/UserValidation";

type AuthFormProps = {
  mode: "login" | "register";
};

type FormErrors = {
  name?: string;
  email?: string;
  password?: string;
};

/* ONE FORM FOR THE TWO SCREENS: THE ONLY DIFFERENCE IS THE NAME FIELD */
export function AuthForm({ mode }: AuthFormProps) {
  const isRegister = mode === "register";
  const router = useRouter();
  const searchParams = useSearchParams();

  /* ONLY INTERNAL ADDRESSES, SO NOBODY USES THE LINK TO SEND PEOPLE TO ANOTHER SITE */
  const rawRedirect = searchParams.get("redirect") ?? "";
  const redirect = rawRedirect.startsWith("/") && !rawRedirect.startsWith("//") ? rawRedirect : "/";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [generalError, setGeneralError] = useState("");
  const [loading, setLoading] = useState(false);

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
    setGeneralError("");

    const newErrors = validate();
    setErrors(newErrors);

    if (Object.values(newErrors).some(Boolean))
      return;

    setLoading(true);

    try {
      const response = await fetch(isRegister ? "/api/users/register" : "/api/users/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(isRegister ? { name, email, password } : { email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setGeneralError(data.error || "Não foi possível continuar.");
        return;
      };

      NotifyAuthChange();
      router.push(redirect);
      router.refresh();
    }

    catch {
      setGeneralError("Erro de conexão com o servidor.");
    }

    finally {
      setLoading(false);
    };
  };

  return (
    <form onSubmit={handleSubmit} className="card column gap-4 w-full max-w-md">
      <h1 className="title text-center">
        {isRegister ? "Criar conta" : "Entrar"}
      </h1>

      <p className="text-sm text-center opacity-70">
        {isRegister ? "Já tem conta?" : "Ainda não tem conta?"}{" "}
        <Link
          href={`${isRegister ? "/entrar" : "/cadastro"}${redirect !== "/" ? `?redirect=${encodeURIComponent(redirect)}` : ""}`}
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
