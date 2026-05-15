/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './views/**/*.ejs',
    './public/js/**/*.js',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1D6AE5',
          light:   '#EEF4FF',
          dark:    '#1558C0',
        },
        amber: { DEFAULT: '#F59E0B', light: '#FFFBEB' },
        green: { DEFAULT: '#059669', light: '#ECFDF5' },
        red:   { DEFAULT: '#DC2626', light: '#FEF2F2' },
        ink: {
          1: '#1A1A2E',
          2: '#4A4A6A',
          3: '#8888AA',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          alt:     '#F4F4F8',
          page:    '#FAFAF8',
        },
        line: {
          DEFAULT: '#E8E8F0',
          strong:  '#D0D0E8',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', '"Be Vietnam Pro"', 'system-ui', 'sans-serif'],
        mono: ['"DM Mono"', '"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        sm: '0 1px 4px rgba(26,26,46,0.06)',
        md: '0 4px 20px rgba(26,26,46,0.09)',
        lg: '0 12px 48px rgba(26,26,46,0.12)',
      },
      borderRadius: {
        sm: '6px',
        md: '12px',
        lg: '20px',
        xl: '28px',
      },
    },
  },
  plugins: [],
  // Don't reset existing styles — keep legacy CSS working
  corePlugins: {
    preflight: false,
  },
};
