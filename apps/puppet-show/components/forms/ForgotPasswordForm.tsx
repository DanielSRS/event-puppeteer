import React, { useState } from 'react';

interface ForgotPasswordFormProps {
  onSubmit: (email: string) => void;
  isLoading: boolean;
  successMessage?: string;
}

export function ForgotPasswordForm({ onSubmit, isLoading, successMessage }: ForgotPasswordFormProps) {
  const [email, setEmail] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      onSubmit(email);
    }
  };

  return (
    <div className="w-full max-w-md bg-surface rounded-xl shadow-sm border border-muted p-8">
      <h2 className="text-2xl font-bold text-foreground text-center mb-2">Recuperar Senha</h2>
      <p className="text-foreground/60 text-center text-sm mb-6">
        Digite seu e-mail e enviaremos instruções para redefinir sua senha.
      </p>

      {successMessage ? (
        <div className="p-4 bg-success/10 text-success rounded-lg text-center text-sm">
          {successMessage}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-foreground">E-mail</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="input mt-1"
              placeholder="seu@email.com"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !email}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-background bg-main hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-main disabled:opacity-50"
          >
            {isLoading ? 'Enviando...' : 'Enviar link de recuperação'}
          </button>
        </form>
      )}
    </div>
  );
}
