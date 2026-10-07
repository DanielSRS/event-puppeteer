/* app/eventos/novo/page.tsx */

import Link from "next/link";
import { EventForm } from "@/components/forms/EventForm";

export default function NewEventPage() {
  return (
    <main className="column gap-4 p-4 max-w-2xl w-full mx-auto">
      <div className="column gap-1">
        <Link href="/" className="text-sm text-main underline w-fit">
          Voltar para os eventos
        </Link>

        <h1 className="title">
          Publicar evento
        </h1>

        <p className="text-sm opacity-60">
          Ele entra na lista assim que você publicar, e sobe conforme recebe curtidas.
        </p>
      </div>

      <EventForm />
    </main>
  );
};
