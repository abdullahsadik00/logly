import type { Config } from 'tailwindcss';

/** Resolve a semantic color token to an alpha-aware rgb() so `bg-accent/10` works. */
const token = (name: string) => `rgb(var(${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Semantic tokens → CSS variables (see src/styles/tokens.css).
        // A future light theme is a :root variable swap; no class changes.
        base: token('--c-bg-base'),
        panel: token('--c-bg-panel'),
        raised: token('--c-bg-raised'),
        surface: {
          DEFAULT: token('--c-surface'),
          hover: token('--c-surface-hover'),
        },
        line: {
          subtle: token('--c-border-subtle'),
          DEFAULT: token('--c-border'),
          strong: token('--c-border-strong'),
        },
        fg: {
          DEFAULT: token('--c-fg'),
          secondary: token('--c-fg-secondary'),
          muted: token('--c-fg-muted'),
          faint: token('--c-fg-faint'),
        },
        accent: {
          DEFAULT: token('--c-accent'),
          contrast: token('--c-accent-contrast'),
        },
        danger: token('--c-danger'),
        warning: token('--c-warning'),
        info: token('--c-info'),
        violet: token('--c-violet'),
        teal: token('--c-teal'),
      },
      fontFamily: {
        sans: ['Geist', 'Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['Geist Mono', 'JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        xl: 'var(--shadow-xl)',
      },
      transitionTimingFunction: {
        brand: 'var(--ease-brand)',
      },
      transitionDuration: {
        instant: '120ms',
        fast: '160ms',
        base: '220ms',
        slow: '360ms',
      },
      zIndex: {
        scrim: '80',
        palette: '81',
        dialog: '83',
        toast: '90',
      },
      opacity: {
        disabled: '0.45',
        muted: '0.6',
        subtle: '0.72',
      },
      keyframes: {
        // Realtime pulse ring
        lglpulse: {
          '0%': { transform: 'scale(1)', opacity: '0.55' },
          '100%': { transform: 'scale(2.4)', opacity: '0' },
        },
        // Fade + rise (toasts, dialogs, palette)
        lglin: {
          '0%': { opacity: '0', transform: 'translateY(-6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        // Rise from below (content entrances)
        lglup: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        // Loading shimmer sweep
        lglshim: {
          '0%': { backgroundPosition: '-200px 0' },
          '100%': { backgroundPosition: 'calc(200px + 100%) 0' },
        },
        // Drawer slide-in from the right
        lglslide: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        lglpulse: 'lglpulse 1.6s ease-out infinite',
        lglin: 'lglin 180ms var(--ease-brand)',
        lglup: 'lglup 500ms var(--ease-brand)',
        lglshim: 'lglshim 1.4s infinite',
        lglslide: 'lglslide 220ms var(--ease-brand)',
        lglspin: 'spin 0.7s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
