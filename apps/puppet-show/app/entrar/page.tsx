/* app/entrar/page.tsx */

import { Suspense } from "react";
import { AuthForm } from "@/components/forms/AuthForm";

/* THE FORM READS ?redirect= FROM THE URL, SO IT NEEDS THE SUSPENSE */
export default function LoginPage() {
  return (
    <main className="center flex-1 p-4">
      <Suspense fallback={<p className="opacity-60">Carregando...</p>}>
        <AuthForm mode="login" />
      </Suspense>
    </main>
  );
};
