/**
 * New password: `/redefinir-senha?token=…`, opened from the reset email.
 *
 * @module
 */

import { Suspense } from "react";
import { ResetPasswordContainer } from "@/components/forms/containers/ResetPasswordContainer";
import { LoadingMessage } from "@/components/ui/Feedback";

export const metadata = { title: "Nova senha" };

/** The form reads the token from the query string (`useSearchParams`), so it renders inside `Suspense`. */
export default function ResetPasswordPage() {
  return (
    <main className="center flex-1 px-4 py-12 sm:px-6">
      <Suspense fallback={<LoadingMessage>Carregando...</LoadingMessage>}>
        <ResetPasswordContainer />
      </Suspense>
    </main>
  );
}
