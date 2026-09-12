/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    container: {
      center: true,
      padding: '1rem',
    },
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        pass: {
          DEFAULT: 'var(--pass)',
          bg: 'var(--pass-bg)',
          border: 'var(--pass-border)',
        },
        review: {
          DEFAULT: 'var(--review)',
          bg: 'var(--review-bg)',
          border: 'var(--review-border)',
        },
        flag: {
          DEFAULT: 'var(--flag)',
          bg: 'var(--flag-bg)',
          border: 'var(--flag-border)',
        },
        navy: {
          DEFAULT: 'var(--navy)',
          secondary: 'var(--navy-secondary)',
        },
      },
      borderRadius: {
        DEFAULT: 'var(--radius)',
        sm: 'calc(var(--radius) - 4px)',
        lg: 'var(--radius)',
        xl: 'calc(var(--radius) + 4px)',
        '2xl': 'calc(var(--radius) + 8px)',
        '3xl': 'calc(var(--radius) + 16px)',
      },
      fontFamily: {
        sans: ['var(--font-plus-jakarta-sans)', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)',
        'finding': '0 2px 8px rgba(30, 64, 175, 0.12)',
      },
      animation: {
        'evidence-pulse': 'evidencePulse 1.8s ease-in-out infinite',
        'scan-line': 'scanLine 2s ease-in-out infinite',
        'pulse-ring': 'pulseRing 2s ease-out infinite',
        'fade-in-up': 'fadeInUp 0.4s ease-out forwards',
        'bounce-in': 'bounceIn 0.5s ease-out forwards',
        'slide-in-right': 'slideInRight 0.3s ease-out forwards',
        'shimmer': 'shimmer 1.5s infinite',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
