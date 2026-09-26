/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: '#142D4E',
        },
        interactive: {
          blue: '#245DB0',
        },
        workspace: '#F7F8FA',
        sidebar: '#FCFCFD',
        surface: '#FFFFFF',
        text: {
          primary: '#182230',
          secondary: '#596579',
        },
        border: {
          subtle: '#E3E7ED',
        },
        nav: {
          hover: '#F0F3F7',
          activeBg: '#EAF1FB',
          activeText: '#194B91',
        },
        focusRing: '#245DB0',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        dropdown: '0 4px 16px -2px rgba(16, 24, 40, 0.08), 0 2px 6px -2px rgba(16, 24, 40, 0.04)',
        drawer: '4px 0 24px 0 rgba(16, 24, 40, 0.12)',
        tooltip: '0 2px 8px 0 rgba(16, 24, 40, 0.12)',
      },
      borderRadius: {
        item: '8px',
        menu: '12px',
      }
    },
  },
  plugins: [],
}
