/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        heading: ['"Space Grotesk"', '"Plus Jakarta Sans"', 'sans-serif'],
        display: ['Sora', '"Space Grotesk"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        abyssal: {
          950: '#020710',
          900: '#05101d',
          850: '#091829',
          800: '#0f243a',
          700: '#183652',
          600: '#234a6e',
        },
        ocean: {
          cyan: '#2dd4bf',
          bright: '#06b6d4',
          teal: '#0d9488',
          deep: '#0f766e',
          foam: '#e0f2fe',
        },
        coral: {
          alert: '#f43f5e',
          glow: '#fb7185',
          dark: '#881337',
        },
        gold: {
          telemetry: '#f59e0b',
          glow: '#fbbf24',
        },
        brand: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          500: '#06b6d4',
          600: '#0284c7',
          700: '#0369a1',
          900: '#0c4a6e',
        },
        slate: {
          850: '#111c2e',
          950: '#030712',
        }
      },
      boxShadow: {
        'glow-cyan': '0 0 25px -5px rgba(45, 212, 191, 0.35)',
        'glow-cyan-sm': '0 0 12px -2px rgba(45, 212, 191, 0.25)',
        'glow-coral': '0 0 25px -5px rgba(244, 63, 94, 0.4)',
        'glow-gold': '0 0 25px -5px rgba(245, 158, 11, 0.35)',
        'inner-glow': 'inset 0 1px 1px 0 rgba(255, 255, 255, 0.08)',
      },
      animation: {
        'pulse-glow': 'pulseGlow 2.5s infinite ease-in-out',
        'float': 'float 3.5s ease-in-out infinite',
        'radar-sweep': 'radarSweep 4s linear infinite',
        'wave-pulse': 'wavePulse 2s ease-out infinite',
        'shimmer': 'shimmer 2.5s infinite',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { opacity: '1', filter: 'drop-shadow(0 0 15px rgba(45, 212, 191, 0.5))' },
          '50%': { opacity: '0.6', filter: 'drop-shadow(0 0 5px rgba(45, 212, 191, 0.2))' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        radarSweep: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        wavePulse: {
          '0%': { transform: 'scale(0.9)', opacity: '0.9' },
          '100%': { transform: 'scale(1.4)', opacity: '0' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        }
      }
    },
  },
  plugins: [],
}
