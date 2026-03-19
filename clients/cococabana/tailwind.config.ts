import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './apps/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        sky: {
          DEFAULT: '#00b4d8',
          dark: '#0096b7',
        },
        coco: {
          black: '#000000',
          white: '#ffffff',
          gray: '#f5f5f5',
          'gray-mid': '#888888',
          'gray-dark': '#333333',
          border: '#e5e5e5',
        },
      },
      fontFamily: {
        sans:    ['var(--font-lato)',      'Lato',      'sans-serif'],
        heading: ['var(--font-marcellus)', 'Marcellus', 'serif'],
      },
      maxWidth: {
        container: '1280px',
      },
    },
  },
  plugins: [],
};

export default config;
