import React from 'react';
import { ForgotPasswordContainer } from '@/components/forms/ForgotPasswordContainer';
import Link from 'next/link';

export const metadata = {
  title: 'Esqueci a Senha',
};

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <Link href="/" className="text-3xl font-extrabold text-blue-600">
          Puppet Show
        </Link>
      </div>

      <ForgotPasswordContainer />
      
      <div className="mt-4">
        <Link href="/entrar" className="text-sm font-medium text-blue-600 hover:text-blue-500">
          Voltar para o login
        </Link>
      </div>
    </div>
  );
}
