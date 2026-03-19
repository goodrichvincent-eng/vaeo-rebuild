import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        navy:           '#1a243f',
        'navy-dark':    '#060b19',
        gold:           '#D9AD0C',
        'text-body':    '#5f5f5f',
        'text-dark':    '#181d23',
        'border-light': '#eaeaeb',
      },
      fontFamily: {
        playfair: ['var(--font-playfair)', 'Georgia', 'serif'],
        inter:    ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      maxWidth: {
        container: '1170px',
      },
    },
  },
  plugins: [],
};

export default config;
