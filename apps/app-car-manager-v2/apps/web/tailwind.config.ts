import type { Config } from 'tailwindcss';

// Tokens ported verbatim from design/project/tokens.jsx.
// Korean enterprise SaaS · Toss-inspired blue · data-dense.
const config: Config = {
  content: ['./src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand blue (Toss-inspired #3182F6 family)
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3182f6',
          600: '#2566db',
          700: '#1d4fb0',
          800: '#1c3f88',
          900: '#1a356b',
        },
        // Cool neutral with a hint of blue (enterprise)
        neutral: {
          0: '#ffffff',
          25: '#fbfbfd',
          50: '#f7f8fa',
          75: '#f1f3f6',
          100: '#e7eaf0',
          150: '#d9dde5',
          200: '#c8ced9',
          300: '#a8b1c0',
          400: '#7e8799',
          500: '#5b6374',
          600: '#424a59',
          700: '#2d3340',
          800: '#1a1f2a',
          900: '#0b1018',
        },
        // Semantic
        success: { 50: '#ecfdf3', 100: '#d1fadf', 500: '#12b76a', 600: '#039855', 700: '#027a48' },
        warning: { 50: '#fffaeb', 100: '#fef0c7', 500: '#f79009', 600: '#dc6803', 700: '#b54708' },
        danger:  { 50: '#fef3f2', 100: '#fee4e2', 500: '#f04438', 600: '#d92d20', 700: '#b42318' },
        purple:  { 50: '#f4f3ff', 100: '#ebe9fe', 500: '#7a5af8', 600: '#6938ef', 700: '#5925dc' },
        teal:    { 50: '#f0fdfa', 100: '#ccfbf1', 500: '#14b8a6', 600: '#0d9488', 700: '#0f766e' },
      },
      fontFamily: {
        sans: [
          'Pretendard Variable',
          'Pretendard',
          '-apple-system',
          'BlinkMacSystemFont',
          'Apple SD Gothic Neo',
          'Noto Sans KR',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
        mono: [
          'JetBrains Mono',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'monospace',
        ],
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgba(0,0,0,0.06)',
        DEFAULT: '0 1px 3px 0 rgba(0,0,0,0.08), 0 1px 2px -1px rgba(0,0,0,0.04)',
        md: '0 4px 6px -1px rgba(0,0,0,0.08), 0 2px 4px -2px rgba(0,0,0,0.04)',
        lg: '0 10px 15px -3px rgba(0,0,0,0.08), 0 4px 6px -4px rgba(0,0,0,0.04)',
      },
    },
  },
  plugins: [],
};

export default config;
