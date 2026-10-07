import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { AuditList } from './AuditList';

const meta = {
  title: 'Dashboard/Audit/AuditList',
  component: AuditList,
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof AuditList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    logs: [
      {
        id: 'log-1',
        action: 'Ocultar Evento',
        actorName: 'Alice Admin',
        actorEmail: 'alice@uefs.br',
        targetId: 'evt-123',
        timestamp: new Date().toISOString(),
        details: 'Motivo: Fraude / Spam',
      },
      {
        id: 'log-2',
        action: 'Promover Tag',
        actorName: 'Bob Mod',
        actorEmail: 'bob@uefs.br',
        targetId: 'tag-456',
        timestamp: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
        details: 'Tag: #hackathon',
      },
    ],
  },
};

export const Empty: Story = {
  args: {
    logs: [],
  },
};
