import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        neutral: {
          50: '#fafaf8',
          100: '#f6f4ef',
          150: '#f0efec',
          200: '#ececea',
          300: '#dcdad5',
          400: '#a8a6a0',
          500: '#87867f',
          600: '#5c5b58',
          700: '#3d3c3a',
          800: '#29261b',
          900: '#131313',
          950: '#0e0e0c',
        },
        accent: {
          50: '#fdf5ee',
          100: '#f9e3ce',
          500: '#d97757',
          600: '#c5634a',
          700: '#a85540',
        },
        success: {
          50: '#dcfce7',
          500: '#15803d',
        },
        error: {
          50: '#fee2e2',
          500: '#b91c1c',
        },
        warning: {
          50: '#fef3c7',
          500: '#b45309',
        },
        info: {
          50: '#dbeafe',
          500: '#2a6fdb',
        },
        shopee: '#ee4d2d',
        tiktok: '#fe2c55',
      },
      fontFamily: {
        sans: ['var(--font-plus-jakarta)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgba(0,0,0,0.06)',
        DEFAULT: '0 1px 3px 0 rgba(0,0,0,0.10), 0 1px 2px -1px rgba(0,0,0,0.06)',
        md: '0 4px 6px -1px rgba(0,0,0,0.10), 0 2px 4px -2px rgba(0,0,0,0.06)',
        lg: '0 10px 15px -3px rgba(0,0,0,0.10), 0 4px 6px -4px rgba(41,38,27,0.12)',
      },
    },
  },
  plugins: [],
};

export default config;
