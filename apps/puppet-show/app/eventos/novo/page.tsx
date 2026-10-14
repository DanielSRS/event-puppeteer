/**
 * `/eventos/novo`: publish an event in your organization.
 *
 * @module
 */

import type { Metadata } from "next";
import { NewEventContainer } from "./NewEventContainer";

export const metadata: Metadata = {
  title: "Novo evento",
};

/** Page shell (caption, title and the editor card); the session check and the editor run on the client. */
export default function NewEventPage() {
  return (
    <main className="flex-1 w-full px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-2xl column gap-5">
        <div className="column gap-1.5">
          <span className="caption">Publicar evento</span>
          <h1 className="h1">Novo evento</h1>
        </div>
        <NewEventContainer />
      </div>
    </main>
  );
}
