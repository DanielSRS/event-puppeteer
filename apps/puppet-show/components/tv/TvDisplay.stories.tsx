import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { TvDisplay } from './TvDisplay';

const meta = {
  title: 'TV/TvDisplay',
  component: TvDisplay,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof TvDisplay>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    appUrl: 'https://uefs.puppet-show.com',
    orgName: 'UEFS',
    events: [
      {
        id: '1',
        title: 'V Feira de Santana Nerd',
        date: new Date().toISOString().slice(0, 10),
        time: '10:00',
        location: 'Praça Principal',
      },
      {
        id: '2',
        title: 'Oficina de Robótica Básica',
        date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
        time: '14:30',
        location: 'Laboratório de Hardware',
      },
    ],
  },
};
