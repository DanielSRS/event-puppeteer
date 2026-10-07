import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { EventDetails } from './EventDetails';

const meta = {
  title: 'Events/EventDetails',
  component: EventDetails,
  parameters: { layout: 'padded' },
  args: {
    onReport: fn(),
    onShare: fn(),
  },
} satisfies Meta<typeof EventDetails>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    event: {
      id: 'evt-123',
      title: 'Semana de Tecnologia UEFS',
      description: 'Participe da maior semana de tecnologia do interior da Bahia. Palestras, minicursos, hackathons e muito networking!',
      authorName: 'Centro Acadêmico de Computação',
      schedule: [
        { date: '2026-10-15', startTime: '08:00', endTime: '12:00', activity: 'Credenciamento e Abertura' },
        { date: '2026-10-15', startTime: '14:00', endTime: '18:00', activity: 'Hackathon: Desafios Locais' },
        { date: '2026-10-16', startTime: '09:00', endTime: '11:00', activity: 'Palestra: Inteligência Artificial' },
      ],
      location: 'Auditório Principal - Módulo 2',
      mapUrl: 'https://maps.example.com/place',
      links: [
        { id: 'lnk-1', label: 'Inscrições no Sympla', url: '#' },
        { id: 'lnk-2', label: 'Instagram Oficial', url: '#' },
      ],
      tags: ['tecnologia', 'inovação', 'hackathon'],
    },
  },
};
