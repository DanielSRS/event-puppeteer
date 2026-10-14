/**
 * "Esqueci minha senha": `/esqueci-senha`.
 *
 * @module
 */

import { ForgotPasswordContainer } from "@/components/forms/containers/ForgotPasswordContainer";

export const metadata = { title: "Esqueci minha senha" };

/** Asks for the e-mail that receives the reset link. */
export default function ForgotPasswordPage() {
  return (
    <main className="center flex-1 px-4 py-12 sm:px-6">
      <ForgotPasswordContainer />
    </main>
  );
}
