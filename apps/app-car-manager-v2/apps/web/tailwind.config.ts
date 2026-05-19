import type { Config } from 'tailwindcss';

/* CCMS Design System — Swiss Modernism 2.0 + Minimalism.
 * Tokens defined as CSS variables in `packages/ui/src/tokens.css`.
 * This file maps the variables to Tailwind utilities. */
const config: Config = {
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '1.5rem',
      screens: { '2xl': '1440px' },
    },
    extend: {
      fontFamily: {
        sans: [
          'Pretendard Variable',
          'Pretendard',
          'var(--font-be-vietnam)',
          'var(--font-inter)',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'sans-serif',
        ],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        xs:   ['12px', { lineHeight: '16px' }],
        sm:   ['13px', { lineHeight: '18px' }],
        base: ['14px', { lineHeight: '20px' }],
        md:   ['15px', { lineHeight: '22px' }],
        lg:   ['17px', { lineHeight: '24px' }],
        xl:   ['20px', { lineHeight: '28px' }],
        '2xl':['24px', { lineHeight: '32px' }],
        '3xl':['30px', { lineHeight: '38px' }],
        '4xl':['36px', { lineHeight: '44px' }],
      },
      colors: {
        bg:             'hsl(var(--bg) / <alpha-value>)',
        surface:        'hsl(var(--surface) / <alpha-value>)',
        'surface-2':    'hsl(var(--surface-2) / <alpha-value>)',
        border:         'hsl(var(--border) / <alpha-value>)',
        'border-strong':'hsl(var(--border-strong) / <alpha-value>)',
        ring:           'hsl(var(--ring) / <alpha-value>)',
        text: {
          DEFAULT: 'hsl(var(--text) / <alpha-value>)',
          muted:   'hsl(var(--text-muted) / <alpha-value>)',
          faint:   'hsl(var(--text-faint) / <alpha-value>)',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
          fg:      'hsl(var(--primary-fg) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent) / <alpha-value>)',
          fg:      'hsl(var(--accent-fg) / <alpha-value>)',
          soft:    'hsl(var(--accent-soft) / <alpha-value>)',
        },
        success: {
          DEFAULT: 'hsl(var(--success) / <alpha-value>)',
          fg:      'hsl(var(--success-fg) / <alpha-value>)',
          soft:    'hsl(var(--success-soft) / <alpha-value>)',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning) / <alpha-value>)',
          fg:      'hsl(var(--warning-fg) / <alpha-value>)',
          soft:    'hsl(var(--warning-soft) / <alpha-value>)',
        },
        danger: {
          DEFAULT: 'hsl(var(--danger) / <alpha-value>)',
          fg:      'hsl(var(--danger-fg) / <alpha-value>)',
          soft:    'hsl(var(--danger-soft) / <alpha-value>)',
        },
        info: {
          DEFAULT: 'hsl(var(--info) / <alpha-value>)',
          fg:      'hsl(var(--info-fg) / <alpha-value>)',
          soft:    'hsl(var(--info-soft) / <alpha-value>)',
        },
        purple: {
          DEFAULT: 'hsl(var(--purple) / <alpha-value>)',
          fg:      'hsl(var(--purple-fg) / <alpha-value>)',
          soft:    'hsl(var(--purple-soft) / <alpha-value>)',
        },
        chart: {
          1: 'hsl(var(--c1))',
          2: 'hsl(var(--c2))',
          3: 'hsl(var(--c3))',
          4: 'hsl(var(--c4))',
          5: 'hsl(var(--c5))',
          6: 'hsl(var(--c6))',
          7: 'hsl(var(--c7))',
          8: 'hsl(var(--c8))',
        },
      },
      borderRadius: {
        none:    '0',
        sm:      '4px',
        DEFAULT: '6px',
        md:      '8px',
        lg:      '12px',
        xl:      '16px',
        full:    '9999px',
      },
      boxShadow: {
        xs: '0 1px 2px 0 rgb(15 23 42 / 0.04)',
        sm: '0 1px 3px 0 rgb(15 23 42 / 0.06), 0 1px 2px -1px rgb(15 23 42 / 0.04)',
        md: '0 4px 6px -2px rgb(15 23 42 / 0.06), 0 2px 4px -2px rgb(15 23 42 / 0.04)',
        lg: '0 12px 16px -4px rgb(15 23 42 / 0.08), 0 4px 6px -2px rgb(15 23 42 / 0.04)',
        pop:'0 8px 24px rgb(15 23 42 / 0.12)',
      },
      transitionDuration: {
        DEFAULT: '180ms',
      },
      /* iOS safe-area utilities — for components positioned at the screen
       * edge in PWA standalone mode (notch, home indicator). Usage:
       *   pt-safe-top, pb-safe-bottom, pl-safe-left, pr-safe-right
       *   mb-safe-bottom, etc. */
      spacing: {
        'safe-top':    'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-left':   'env(safe-area-inset-left)',
        'safe-right':  'env(safe-area-inset-right)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to:   { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to:   { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 180ms ease-out',
        'accordion-up':   'accordion-up 180ms ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
