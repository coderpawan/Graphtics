import type { Config } from 'tailwindcss';
import typography from '@tailwindcss/typography';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Inter', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 45px rgba(124, 58, 237, 0.18)',
      },
      backgroundImage: {
        'hero-gradient': 'radial-gradient(circle at top, rgba(99,102,241,0.22), transparent 45%)',
      },
      colors: {
        surface: '#121212',
        panel: '#161616',
        accent: '#8b5cf6',
        muted: '#a1a1aa',
      },
    },
  },
  plugins: [typography],
} satisfies Config;
