/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        potens: {
          navy: '#15237A',
          orange: '#F26300',
          line: '#D9D9D9',
          body: '#5C5C5C',
          black: '#111111',
        },
      },
      fontFamily: {
        sans: [
          'Pretendard',
          '-apple-system',
          'BlinkMacSystemFont',
          'system-ui',
          'sans-serif',
        ],
      },
      transitionDuration: {
        soft: '220ms',
      },
    },
  },
  plugins: [],
};
