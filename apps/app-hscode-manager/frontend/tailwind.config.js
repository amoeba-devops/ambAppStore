/** @type {import('tailwindcss').Config} */
// 디자인 토큰은 목업(hscode-manager-mockup.html :root)에서 이식
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#1F2937',
        muted: '#6B7280',
        muted2: '#9CA3AF',
        line: '#E5E7EB',
        line2: '#D1D5DB',
        brand: {
          DEFAULT: '#6366F1',
          dark: '#4F46E5',
          light: '#818CF8',
          soft: '#EEF2FF',
        },
        ok: { DEFAULT: '#10B981', soft: '#E7F8F1' },
        warn: { DEFAULT: '#F59E0B', soft: '#FEF3E2' },
        bad: { DEFAULT: '#EF4444', soft: '#FDECEC' },
        info: { DEFAULT: '#3B82F6', soft: '#EAF2FE' },
      },
      borderRadius: {
        DEFAULT: '12px',
        s: '8px',
      },
      fontFamily: {
        sans: [
          'Pretendard',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Apple SD Gothic Neo',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};
