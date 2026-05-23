/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: { 50:'#e8f4fd', 500:'#1a6bb5', 700:'#0e4a82', 900:'#082d52' }
      }
    }
  },
  plugins: []
}
