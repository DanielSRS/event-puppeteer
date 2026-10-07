import React from 'react';
import { EventDetailsContainer } from '@/components/events/EventDetailsContainer';
import Link from 'next/link';
import { MdArrowBack } from 'react-icons/md';

export const metadata = {
  title: 'Detalhes do Evento',
};

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto mb-6">
        <Link href="/" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors font-medium">
          <MdArrowBack className="w-5 h-5" /> Voltar para o Mural
        </Link>
      </div>

      <EventDetailsContainer eventId={resolvedParams.id} />
    </div>
  );
}
