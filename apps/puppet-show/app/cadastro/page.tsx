/**
 * Sign-up: `/cadastro`.
 *
 * @module
 */

import { Suspense } from "react";
import { AuthFormContainer } from "@/components/forms/containers/AuthFormContainer";
import { LoadingMessage } from "@/components/ui/Feedback";

/** The form reads the query string (`useSearchParams`), so it renders inside `Suspense`. */
export default function RegisterPage() {
  return (
    <main className="center flex-1 p-4">
      <Suspense fallback={<LoadingMessage>Carregando...</LoadingMessage>}>
        <AuthFormContainer mode="register" />
      </Suspense>
    </main>
  );
}
