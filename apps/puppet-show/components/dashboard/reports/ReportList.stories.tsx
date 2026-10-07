import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { ReportList } from './ReportList';

const meta = {
  title: 'Dashboard/Reports/ReportList',
  component: ReportList,
  parameters: {
    layout: 'padded',
  },
  args: {
    onToggleVisibility: fn(),
    onResolveReport: fn(),
  },
} satisfies Meta<typeof ReportList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    reports: [
      {
        id: 'rep-1',
        eventId: 'evt-100',
        eventTitle: 'Festa Clandestina',
        reason: 'Conteúdo Inapropriado',
        comment: 'Este evento promove atividades não permitidas na universidade.',
        reportedAt: '2023-11-20T10:00:00Z',
        status: 'pending',
        eventIsHidden: false,
      },
      {
        id: 'rep-2',
        eventId: 'evt-101',
        eventTitle: 'Esquema de Pirâmide',
        reason: 'Spam / Fraude',
        comment: 'Estão cobrando para entrar num esquema suspeito.',
        reportedBy: 'user@example.com',
        reportedAt: '2023-11-21T15:30:00Z',
        status: 'pending',
        eventIsHidden: true,
      },
    ],
  },
};

export const Empty: Story = {
  args: {
    reports: [],
  },
};
