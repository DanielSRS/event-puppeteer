import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { OrgManager } from './OrgManager';

const meta = {
  title: 'Dashboard/Global/OrgManager',
  component: OrgManager,
  parameters: { layout: 'padded' },
  args: {
    onEditOrg: fn(),
    onCreateOrg: fn(),
  },
} satisfies Meta<typeof OrgManager>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    organizations: [
      {
        id: 'org-1',
        name: 'Universidade Estadual de Feira de Santana',
        acronym: 'UEFS',
        domain: 'uefs.puppet-show.com',
        primaryColor: '#004C99',
      },
      {
        id: 'org-2',
        name: 'Instituto Federal da Bahia',
        acronym: 'IFBA',
        domain: 'ifba.puppet-show.com',
        primaryColor: '#2F9E41',
      },
    ],
  },
};
