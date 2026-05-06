/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        scaler: {
          blue:     '#0041CA',
          oxford:   '#021028',
          indigo:   '#324766',
          slate:    '#677993',
          cultured: '#F4F6F9',
          // semantic aliases
          dark:     '#F4F6F9',
          card:     '#FFFFFF',
          border:   '#E2E8F0',
          accent:   '#0041CA',
          text:     '#021028',
          muted:    '#677993',
          orange:   '#0041CA',
        }
      }
    }
  },
  plugins: []
}
