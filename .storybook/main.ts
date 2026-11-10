import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  // Every story and documentation page lives next to the front-end code it
  // describes, e.g. src/front-end/components/Widget/Widget.stories.tsx.
  stories: [
    '../src/front-end/**/*.mdx',
    '../src/front-end/**/*.stories.@(ts|tsx)',
  ],
  addons: [
    // Documentation pages and the automatic documentation of the props.
    '@storybook/addon-docs',
    // Accessibility checks of every story, shown in its own panel.
    '@storybook/addon-a11y',
  ],
  framework: '@storybook/react-vite',
  core: {
    // Storybook would otherwise ask, on first launch, whether it may send
    // anonymous usage data.
    disableTelemetry: true,
  },
};

export default config;
