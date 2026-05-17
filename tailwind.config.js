/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,html}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#667eea',
          secondary: '#764ba2',
          success: '#00f2fe',
          danger: '#ff5858',
        },
      },
    },
  },
  plugins: [],
};

