import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        blinkit: { DEFAULT: '#0C831F', light: '#E8F5E9' },
        zepto:   { DEFAULT: '#8025FB', light: '#F3E8FF' },
        bigbasket: { DEFAULT: '#84C225', light: '#F0F9E8' },
        swiggy:  { DEFAULT: '#FC8019', light: '#FFF3E8' },
        jiomart: { DEFAULT: '#0063AE', light: '#E3F2FD' },
        dmart:   { DEFAULT: '#D71920', light: '#FDE8E9' },
        firstclub: { DEFAULT: '#FF6B00', light: '#FFF0E6' },
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'pulse-slow': 'pulse 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 1.5s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
      },
    },
  },
  plugins: [],
}

export default config
