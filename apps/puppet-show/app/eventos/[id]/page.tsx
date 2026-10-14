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
    <main className="w-full px-4 pb-20 pt-4 sm:px-6 lg:pt-6">
      <div className="mx-auto column w-full max-w-[1280px] gap-6">
        <Link href="/" className="t2 row min-h-11 self-start gap-2 rounded-xl font-medium transition-colors hover:text-foreground focus-ring">
          <MdArrowBack aria-hidden className="icon" />
          Voltar ao mural
        </Link>

        <EventDetailsContainer eventId={id} />
      </div>
    </main>
  );
}
