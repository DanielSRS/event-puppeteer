import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { QrCodePanel } from './QrCodePanel';

const meta = {
  title: 'Components/QrCode/QrCodePanel',
  component: QrCodePanel,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof QrCodePanel>;

export default meta;
type Story = StoryObj<typeof meta>;

const mockQrSvg = '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="#eee"/><text x="50" y="50" text-anchor="middle" dominant-baseline="middle" font-size="10">QR Code</text></svg>';

export const Side: Story = {
  args: {
    svg: mockQrSvg,
    variant: 'side',
  },
};

export const Footer: Story = {
  args: {
    svg: mockQrSvg,
    variant: 'footer',
  },
};
