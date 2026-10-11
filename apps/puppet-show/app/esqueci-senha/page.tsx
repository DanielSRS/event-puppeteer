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
    <main className="center flex-1 p-4">
      <ForgotPasswordContainer />
    </main>
  );
}
