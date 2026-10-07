/* app/cadastro/page.tsx */

import { Suspense } from "react";
import { AuthFormContainer } from "@/components/forms/containers/AuthFormContainer";

export default function RegisterPage() {
  return (
    <main className="center flex-1 p-4">
      <Suspense fallback={<p className="opacity-60">Carregando...</p>}>
        <AuthFormContainer mode="register" />
      </Suspense>
    </main>
  );
};
