import type { Meta, StoryObj } from '@storybook/react-vite';
import AverageRatingWidget from './AverageRatingWidget';

const meta = {
  title: 'Widgets/Note moyenne',
  component: AverageRatingWidget,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "Le widget « Note moyenne » du tableau de bord : la note moyenne **simple** des films du catalogue, sur 10, avec deux décimales. Chaque film noté compte une fois, quel que soit son nombre de votes : ce n'est pas une note pondérée. La valeur est calculée en amont sur tous les films notés, jamais sur une seule page de films ; le widget se contente de l'afficher.",
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
    average: {
      control: { type: 'number', min: 0, max: 10, step: 0.01 },
      description:
        "Note moyenne simple, sur 10. `null` ou `undefined` quand aucun film n'est noté.",
    },
    status: {
      control: 'inline-radio',
      options: ['ready', 'loading', 'error'],
      description: 'Données prêtes, en cours de chargement, ou en erreur.',
    },
  },
  args: {
    average: 6.78,
    status: 'ready',
  },
} satisfies Meta<typeof AverageRatingWidget>;

export default meta;
type Story = StoryObj<typeof meta>;

/** L'état nominal, tel que dans la maquette : 6,78 / 10. */
export const Nominal: Story = {};

/** La note a toujours deux décimales : 7 s'écrit « 7,00 ». */
export const WholeNumber: Story = {
  args: { average: 7 },
};

/** Au-delà de deux décimales, la note est arrondie : 6,7849 s'écrit « 6,78 ». */
export const RoundedValue: Story = {
  args: { average: 6.7849 },
};

/** Une moyenne de 0 est une vraie note, pas une absence de note. */
export const ZeroIsARealRating: Story = {
  args: { average: 0 },
};

/** Les données sont en cours de chargement. */
export const Loading: Story = {
  args: { status: 'loading' },
};

/** Aucun film n'est noté : le widget ne le remplace pas par 0. */
export const NoRatings: Story = {
  args: { average: null },
};

/** Une valeur hors de l'échelle de 0 à 10 n'est pas une note : aucune donnée. */
export const OutOfScale: Story = {
  args: { average: 11 },
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
