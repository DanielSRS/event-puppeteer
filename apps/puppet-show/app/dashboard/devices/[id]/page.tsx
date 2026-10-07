import React from 'react';
import { DeviceTelemetryContainer } from '@/components/dashboard/devices/DeviceTelemetryContainer';
import Link from 'next/link';
import { MdArrowBack } from 'react-icons/md';

export const metadata = {
  title: 'Telemetria do Dispositivo - Dashboard',
};

export default async function DevicePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/devices" className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600">
          <MdArrowBack className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Detalhes do Dispositivo</h1>
          <p className="mt-1 text-sm text-gray-500">
            Acompanhe o uso de recursos e envie comandos remotos.
          </p>
        </div>
      </div>

      <DeviceTelemetryContainer deviceId={resolvedParams.id} />
    </div>
  );
}
