/**
 * Login: `/entrar` (keeps `?redirect=`).
 *
 * A short pitch for the mural on the left and the login card on the right
 * (stacked on phones), over a few soft decorative shapes.
 *
 * @module
 */

import { Suspense } from "react";
import { AuthFormContainer } from "@/components/forms/containers/AuthFormContainer";
import { LoadingMessage } from "@/components/ui/Feedback";

/** The form reads the query string (`useSearchParams`), so it renders inside `Suspense`. */
export default function LoginPage() {
  return (
    <main className="relative flex-1 flex items-center overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <span className="absolute left-[6%] top-[12%] h-[150px] w-[240px] -rotate-[8deg] rounded-[36px] bg-[var(--g2)] opacity-55 blur-[2px]" />
        <span className="glass absolute bottom-[8%] left-[30%] h-[190px] w-[300px] rotate-[6deg] rounded-[40px]" />
        <span className="absolute right-[4%] top-[6%] h-[180px] w-[180px] rounded-full bg-accent opacity-[.22] blur-[30px]" />
      </div>

      <div className="relative mx-auto flex w-full max-w-page flex-wrap items-center justify-between gap-12 px-4 py-12 sm:px-6">
        <div className="column flex-[1_1_380px] max-w-[560px] gap-6">
          <p className="m-0 font-display text-[clamp(36px,5.4vw,80px)] font-bold leading-[.95] tracking-[-.04em] text-balance">
            Tudo o que acontece no campus, num só mural.
          </p>
          <p className="t2 m-0 max-w-[44ch] text-lg">
            Entre para curtir eventos, publicar os seus e acompanhar o que vai aparecer nos totens.
          </p>
        </div>

        <div className="flex w-full flex-[0_1_440px] justify-center">
          <Suspense fallback={<LoadingMessage>Carregando...</LoadingMessage>}>
            <AuthFormContainer mode="login" />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
