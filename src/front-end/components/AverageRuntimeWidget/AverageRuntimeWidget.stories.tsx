import type { Meta, StoryObj } from '@storybook/react-vite';
import AverageRuntimeWidget from './AverageRuntimeWidget';

const meta = {
  title: 'Widgets/Durée moyenne',
  component: AverageRuntimeWidget,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "Le widget « Durée moyenne » du tableau de bord : la durée moyenne des films du catalogue, en minutes. La valeur est calculée en amont sur les durées valides ; le widget se contente de l'afficher et ne remplace jamais une donnée absente par 0.",
      },
    },
  },
  // A widget fills one tile of the dashboard grid, it is not full width.
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 280 }}>
        <Story />
      </div>
    ),
  ],
  argTypes: {
    minutes: {
      control: 'number',
      description:
        "Durée moyenne en minutes, calculée sur les durées valides. `null` ou `undefined` quand aucune durée n'est connue.",
    },
    status: {
      control: 'inline-radio',
      options: ['ready', 'loading', 'error'],
      description: 'Données prêtes, en cours de chargement, ou en erreur.',
    },
  },
  args: {
    minutes: 107,
    status: 'ready',
  },
} satisfies Meta<typeof AverageRuntimeWidget>;

export default meta;
type Story = StoryObj<typeof meta>;

/** L'état nominal, tel que dans la maquette : 107 min. */
export const Nominal: Story = {};

/** Une moyenne qui n'est pas un nombre entier est arrondie à la minute. */
export const RoundedValue: Story = {
  args: { minutes: 106.6 },
};

/** Les données sont en cours de chargement. */
export const Loading: Story = {
  args: { status: 'loading' },
};

/** Aucune durée valide : le widget ne la remplace pas par 0. */
export const NoData: Story = {
  args: { minutes: null },
};

/** Une moyenne de durées valides vaut au moins 1 minute : 0 n'est pas une durée. */
export const ZeroIsNoData: Story = {
  args: { minutes: 0 },
};

/** Les données n'ont pas pu être récupérées. */
export const ErrorState: Story = {
  args: { status: 'error' },
};

/** Le widget reste lisible sur l'écran d'un téléphone. */
export const Mobile: Story = {
  globals: { viewport: { value: 'mobile1', isRotated: false } },
};

/** Le widget dans le thème sombre. */
export const DarkTheme: Story = {
  globals: { theme: 'dark' },
};
