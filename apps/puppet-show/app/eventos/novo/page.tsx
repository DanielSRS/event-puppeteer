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

/** Page shell; the session check and the editor run on the client. */
export default function NewEventPage() {
  return (
    <main className="flex-1 w-full px-4 py-6 sm:py-10">
      <div className="mx-auto w-full max-w-2xl column gap-4">
        <h1 className="title">Novo evento</h1>
        <NewEventContainer />
      </div>
    </main>
  );
}
