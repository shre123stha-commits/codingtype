/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        obsidian: 'rgb(var(--c-bg) / <alpha-value>)',
        panel: 'rgb(var(--c-panel) / <alpha-value>)',
        panel2: 'rgb(var(--c-panel2) / <alpha-value>)',
        edge: 'rgb(var(--c-edge) / <alpha-value>)',
        edge2: 'rgb(var(--c-edge2) / <alpha-value>)',
        accent: 'rgb(var(--c-accent) / <alpha-value>)',
        accent2: 'rgb(var(--c-accent2) / <alpha-value>)',
        pulse: 'rgb(var(--c-pulse) / <alpha-value>)',
        ink: 'rgb(var(--c-ink) / <alpha-value>)',
        dim: 'rgb(var(--c-dim) / <alpha-value>)',
        faint: 'rgb(var(--c-faint) / <alpha-value>)',
        blood: 'rgb(var(--c-blood) / <alpha-value>)',
        good: 'rgb(var(--c-good) / <alpha-value>)'
      },
      fontFamily: {
        mono: [
          '"JetBrains Mono"',
          '"Fira Code"',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Consolas',
          'monospace'
        ]
      },
      boxShadow: {
        'glow-amber': '0 0 16px rgb(var(--c-accent) / 0.14)',
        'glow-cyan': '0 0 16px rgb(var(--c-pulse) / 0.12)',
        'glow-blood': '0 0 14px rgb(var(--c-blood) / 0.16)',
        'glow-green': '0 0 18px rgb(var(--c-good) / 0.18)'
      },
      animation: {
        blink: 'blink 1.05s steps(2, start) infinite',
        'pulse-soft': 'pulseSoft 2.2s ease-in-out infinite',
        'hint-glow': 'hintGlow 1.8s ease-in-out infinite',
        // must match DURATION_MS in LeaderboardToast.jsx (5s)
        countdown: 'countdown 5s linear forwards'
      },
      keyframes: {
        countdown: {
          from: { width: '100%' },
          to: { width: '0%' }
        },
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' }
        },
        pulseSoft: {
          '0%, 100%': { opacity: '0.55' },
          '50%': { opacity: '1' }
        },
        hintGlow: {
          '0%, 100%': { opacity: '0.5', textShadow: '0 0 4px rgb(var(--c-accent) / 0.25)' },
          '50%': { opacity: '1', textShadow: '0 0 16px rgb(var(--c-accent) / 0.8)' }
        }
      }
    }
  },
  plugins: []
};
