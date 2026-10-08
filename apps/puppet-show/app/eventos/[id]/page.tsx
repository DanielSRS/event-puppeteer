/**
 * Details of one event: `/eventos/<id>`.
 *
 * @module
 */

import type { Metadata } from "next";
import Link from "next/link";
import { MdArrowBack } from "react-icons/md";
import { EventDetailsContainer } from "@/components/events/EventDetailsContainer";

export const metadata: Metadata = {
  title: "Evento | Mural de Eventos",
};

/** Back link to the feed plus the event, loaded in the browser (it depends on the session). */
export default async function EventPage(props: PageProps<"/eventos/[id]">) {
  const { id } = await props.params;

  return (
    <main className="w-full py-6 px-4 sm:px-6 lg:px-8 column gap-4">
      <div className="w-full max-w-4xl mx-auto">
        <Link href="/" className="button clean touch">
          <MdArrowBack aria-hidden className="icon" />
          Voltar para o mural
        </Link>
      </div>

      <EventDetailsContainer eventId={id} />
    </main>
  );
}
