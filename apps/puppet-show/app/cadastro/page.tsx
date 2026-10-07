/* app/cadastro/page.tsx */

import { Suspense } from "react";
import { AuthForm } from "@/components/forms/AuthForm";

export default function RegisterPage() {
  return (
    <main className="center flex-1 p-4">
      <Suspense fallback={<p className="opacity-60">Carregando...</p>}>
        <AuthForm mode="register" />
      </Suspense>
    </main>
  );
};
