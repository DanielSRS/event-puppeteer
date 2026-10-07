/* app/eventos/novo/page.tsx */

import { EventFormContainer } from "@/components/forms/containers/EventFormContainer";

export default function NewEventPage() {
  return (
    <main className="center flex-1 p-4">
      <div className="w-full max-w-xl">
        <h1 className="title mb-4">Novo Evento</h1>
        <EventFormContainer />
      </div>
    </main>
  );
};
