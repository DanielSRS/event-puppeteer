import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { DashboardSidebar } from './DashboardSidebar';

const meta = {
  title: 'Components/Dashboard/DashboardSidebar',
  component: DashboardSidebar,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof DashboardSidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

const MOCK_ORGS = [
  { id: "org-1", name: "Universidade Estadual", acronym: "UEFS" },
  { id: "org-2", name: "Instituto de Tecnologia", acronym: "ITEC" },
];

export const Member: Story = {
  args: {
    userRole: 'MEMBER',
    organizations: MOCK_ORGS,
    currentOrgId: 'org-1',
    onSelectOrg: (id) => console.log('Selected org:', id),
  },
  decorators: [
    (Story) => (
      <div className="h-screen flex">
        <Story />
      </div>
    ),
  ],
};

export const Admin: Story = {
  args: {
    ...Member.args,
    userRole: 'ADMIN',
  },
  decorators: Member.decorators,
};

export const SuperadminGlobal: Story = {
  args: {
    ...Member.args,
    userRole: 'SUPERADMIN',
    currentOrgId: undefined, // Global Context
  },
  decorators: Member.decorators,
};

export const SuperadminInOrg: Story = {
  args: {
    ...Member.args,
    userRole: 'SUPERADMIN',
    currentOrgId: 'org-1',
  },
  decorators: Member.decorators,
};
