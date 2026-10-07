import type { Meta, StoryObj } from '@storybook/nextjs-vite';

// Server Components directly imported into Storybook are not supported in the Vite builder yet.
// We test the Container components instead for complete assembled screens.
const DummyHomePage = () => <div className="p-4 opacity-50">Server Component HomePage (Not renderable in Storybook). Use HomeContainer.stories.tsx instead.</div>;

const meta = {
  title: 'Pages/Home',
  component: DummyHomePage,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof DummyHomePage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ignored: Story = {};
