/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          purple: '#7c3aed',
          violet: '#5b21b6',
          gold:   '#fbbf24',
          cyan:   '#22d3ee',
          dark:   '#0a0a14',
          surface:'rgba(20,20,40,0.85)',
        },
      },
      fontFamily: {
        gaming: ['"Exo 2"', 'sans-serif'],
        body:   ['"Inter"', 'sans-serif'],
      },
      animation: {
        'fade-in':    'fadeIn .4s ease both',
        'slide-up':   'slideUp .5s ease both',
        'slide-left': 'slideLeft .4s ease both',
        'pulse-gold': 'pulseGold 2s ease-in-out infinite',
        'float':      'float 6s ease-in-out infinite',
        'glow':       'glow 2s ease-in-out infinite',
        'spin-slow':  'spin 8s linear infinite',
      },
      keyframes: {
        fadeIn:    { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp:   { from: { opacity: '0', transform: 'translateY(24px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        slideLeft: { from: { opacity: '0', transform: 'translateX(24px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
        pulseGold: { '0%,100%': { boxShadow: '0 0 12px #fbbf2466' }, '50%': { boxShadow: '0 0 28px #fbbf2499' } },
        float:     { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-12px)' } },
        glow:      { '0%,100%': { opacity: '0.6' }, '50%': { opacity: '1' } },
      },
      backgroundImage: {
        'game-bg':     "url('/background-memorymasters.jpg')",
        'grad-purple': 'linear-gradient(135deg, #7c3aed, #4f46e5)',
        'grad-gold':   'linear-gradient(135deg, #fbbf24, #f59e0b)',
        'grad-cyan':   'linear-gradient(135deg, #22d3ee, #06b6d4)',
        'grad-dark':   'linear-gradient(180deg, #0a0a14, #12122a)',
      },
    },
  },
  plugins: [],
}
