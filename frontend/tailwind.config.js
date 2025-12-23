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
        craft: {
          orange: '#FF6B35',
          dark: '#1A1A1A',
          gray: '#F5F5F5',
        },
      },
    },
  },
  plugins: [],
}

