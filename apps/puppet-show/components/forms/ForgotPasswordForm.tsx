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
    <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-gray-200 p-8">
      <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">Recuperar Senha</h2>
      <p className="text-gray-500 text-center text-sm mb-6">
        Digite seu e-mail e enviaremos instruções para redefinir sua senha.
      </p>

      {successMessage ? (
        <div className="p-4 bg-green-50 text-green-800 rounded-lg text-center text-sm">
          {successMessage}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">E-mail</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
              placeholder="seu@email.com"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !email}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {isLoading ? 'Enviando...' : 'Enviar link de recuperação'}
          </button>
        </form>
      )}
    </div>
  );
}
