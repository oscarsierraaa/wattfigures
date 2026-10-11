/**
 * Generic Tailwind config for a generated AdSense content site.
 * Colors read from CSS custom properties (set in assets/shared.css :root), so
 * re-theming is just editing those HSL values. Fonts are injected by scaffold.mjs
 * from site.config.json (Inter / JetBrains Mono).
 */
module.exports = {
  // graphify-out/ is a local analysis artifact that lives inside the site root;
  // scanning its graph.html pulls class names into tw.css that no page uses.
  content: ['./**/*.html', './assets/**/*.js', '!./node_modules/**', '!./graphify-out/**'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background) / <alpha-value>)',
        surface: 'hsl(var(--surface) / <alpha-value>)',
        'surface-2': 'hsl(var(--surface-2) / <alpha-value>)',
        border: 'hsl(var(--border) / <alpha-value>)',
        foreground: 'hsl(var(--foreground) / <alpha-value>)',
        muted: 'hsl(var(--muted) / <alpha-value>)',
        'muted-foreground': 'hsl(var(--muted-foreground) / <alpha-value>)',
        accent: 'hsl(var(--accent) / <alpha-value>)',
        'accent-2': 'hsl(var(--accent-2) / <alpha-value>)',
        'accent-dark': 'hsl(var(--accent-dark) / <alpha-value>)',
        'accent-foreground': 'hsl(var(--accent-foreground) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      maxWidth: { container: '1280px', prose: '720px' },
      borderRadius: { card: '12px', btn: '8px' },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
