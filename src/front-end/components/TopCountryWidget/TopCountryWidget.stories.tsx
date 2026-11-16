import type { Meta, StoryObj } from '@storybook/react-vite';
import TopCountryWidget from './TopCountryWidget';

const meta = {
  title: 'Widgets/Pays le plus représenté',
  component: TopCountryWidget,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "Le widget « Pays le plus représenté » du tableau de bord : le pays qui apparaît dans le plus de films, avec le nombre de films. Il ne compte rien : un film produit dans plusieurs pays est compté pour chacun d'eux en amont, et le widget affiche le nom et l'effectif reçus. Un nom long passe à la ligne au lieu d'être coupé.",
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
    countryName: {
      control: 'text',
      description:
        "Nom du pays le plus représenté, tel qu'il doit être écrit. `null`, `undefined` ou vide quand aucun pays n'est connu.",
    },
    count: {
      control: { type: 'number', min: 0, step: 1 },
      description:
        "Nombre de films du pays : un entier d'au moins 1, sinon le widget n'affiche aucune donnée.",
    },
    status: {
      control: 'inline-radio',
      options: ['ready', 'loading', 'error'],
      description: 'Données prêtes, en cours de chargement, ou en erreur.',
    },
  },
  args: {
    countryName: 'United States of America',
    count: 725,
    status: 'ready',
  },
} satisfies Meta<typeof TopCountryWidget>;

export default meta;
type Story = StoryObj<typeof meta>;

/** L'état nominal, tel que dans la maquette : United States of America, 725 films. */
export const Nominal: Story = {};

/** Un nom de pays long passe à la ligne et reste lisible en entier. */
export const LongName: Story = {
  args: {
    countryName: "Royaume-Uni de Grande-Bretagne et d'Irlande du Nord",
    count: 1234,
  },
};

/** Un nom sans espace, plus large que la carte, ne la fait pas déborder. */
export const UnbreakableName: Story = {
  args: {
    countryName: 'Saint-Vincent-et-les-Grenadines-Saint-Christophe-et-Niévès',
  },
};

/** Avec un seul film, l'unité est au singulier. */
export const SingleMovie: Story = {
  args: { countryName: 'Islande', count: 1 },
};

/** Les données sont en cours de chargement. */
export const Loading: Story = {
  args: { status: 'loading' },
};

/** Aucun pays n'est connu : le widget ne le remplace pas par un pays inventé ni par 0. */
export const NoKnownCountry: Story = {
  args: { countryName: null, count: null },
};

/** Un effectif impossible (0) n'est pas une donnée : aucune donnée. */
export const InvalidCount: Story = {
  args: { count: 0 },
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
