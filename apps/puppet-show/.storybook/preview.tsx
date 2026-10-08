import type { Preview } from '@storybook/nextjs-vite'
import '../app/globals.css';


const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
       color: /(background|color)$/i,
       date: /Date$/i,
      },
    },

    /** Accessibility violations fail the story test. */
    a11y: {
      test: 'error'
    },
    nextjs: {
      appDirectory: true,
    },
  },
};

export default preview;