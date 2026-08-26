/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0a0e1a',
        panel: '#0e1420',
        card: '#111827',
        line: '#1f2a3d',
        muted: '#8b93a7',
        brand: {
          DEFAULT: '#2f6fed',
          dark: '#2558c4',
          light: '#5b8ff9',
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
