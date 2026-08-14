/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: '#1c1b1f',
        muted: '#a09cab',
        surface: '#f2f1fa',
        'surface-2': '#fafaff',
        border: '#d4d2e3',
        'dark-bg': '#0a0e21',
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        xs: ['10px', { lineHeight: '14px' }],
        sm: ['12px', { lineHeight: '16px' }],
        base: ['14px', { lineHeight: '20px' }],
        lg: ['16px', { lineHeight: '24px' }],
        xl: ['18px', { lineHeight: '28px' }],
        '2xl': ['20px', { lineHeight: '28px' }],
        '3xl': ['24px', { lineHeight: '32px' }],
      },
      borderRadius: {
        pill: '999px',
        card: '12px',
      },
      boxShadow: {
        sm: '0px 2px 8px rgba(0, 0, 0, 0.04)',
        md: '0px 4px 16px rgba(0, 0, 0, 0.08)',
        lg: '0px 8px 24px rgba(0, 0, 0, 0.12)',
        xl: '0px 12px 32px rgba(0, 0, 0, 0.16)',
      },
      spacing: {
        safe: 'calc(env(safe-area-inset-bottom) + 1rem)',
      },
    },
  },
  plugins: [],
};
