import type { Decorator, Preview } from '@storybook/react-vite';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
// The same styles as the application, so that a widget looks in Storybook
// exactly as it does in the dashboard.
import '../src/front-end/global.css';
import '../src/front-end/app.css';

type Theme = 'light' | 'dark';

/**
 * Applies the theme chosen in the Storybook toolbar to the page, the same
 * way the application does: through the data-theme attribute of the root.
 */
function ThemeProvider({
  theme,
  children,
}: {
  theme: Theme;
  children: ReactNode;
}) {
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return children;
}

const withTheme: Decorator = (Story, context) => (
  <ThemeProvider theme={context.globals.theme === 'dark' ? 'dark' : 'light'}>
    <Story />
  </ThemeProvider>
);

const preview: Preview = {
  decorators: [withTheme],
  globalTypes: {
    theme: {
      description: "Thème de l'application",
      toolbar: {
        title: 'Thème',
        icon: 'circlehollow',
        items: [
          { value: 'light', title: 'Clair' },
          { value: 'dark', title: 'Sombre' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    theme: 'light',
  },
  parameters: {
    layout: 'padded',
    options: {
      storySort: { order: ['Introduction', 'Widgets', '*'] },
    },
  },
};

export default preview;
