import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Shadcn tokens (kept for Radix UI components)
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: { "1": "hsl(var(--chart-1))", "2": "hsl(var(--chart-2))", "3": "hsl(var(--chart-3))", "4": "hsl(var(--chart-4))", "5": "hsl(var(--chart-5))" },
        // Brand warm orange scale
        brand: {
          50: "#fff4ed",
          100: "#ffe8d6",
          200: "#ffd0b5",
          300: "#ffb088",
          400: "#ff8a55",
          500: "#FF6B35",
          600: "#e5531a",
          700: "#c43d0f",
          800: "#9c2d08",
          900: "#7a2005",
        },
        // App surfaces
        surface: {
          app: "#fffaf5",
          card: "#ffffff",
          subtle: "#fff4ed",
          muted: "#f0ede8",
        },
        // Dark landing surfaces
        dark: {
          bg: "#0b0b0b",
          surface: "#151515",
          raised: "#1e1e1e",
          border: "#2a2a2a",
          "warm-bg": "#0d0905",
          "warm-surface": "#1e0c04",
          "warm-border": "#3d1800",
        },
        // Text scale
        text: {
          primary: "#1a0a00",
          secondary: "#6b3a1f",
          muted: "#9a7060",
          brand: "#FF6B35",
          "on-dark": "#ffffff",
          "on-dark-muted": "#9a8880",
        },
        // Semantic (correct is the only non-warm color — universal affordance)
        correct: "#22c55e",
        "correct-bg": "#f0fdf4",
        "correct-border": "#86efac",
      },
      borderRadius: {
        // Shadcn kept
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        // Spec tokens
        xs: "4px",
        DEFAULT: "8px",
        xl: "24px",
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
        breathe: {
          "0%": { transform: "scale(1)", opacity: "0.7" },
          "100%": { transform: "scale(1.18)", opacity: "1" },
        },
        "timer-pulse": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
        burst: {
          "0%": { transform: "scale(0.4)", opacity: "0" },
          "60%": { transform: "scale(1.15)" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        typewriter: {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "confetti-burst": {
          "0%": { transform: "translateY(0) rotate(0deg) scale(1)", opacity: "1" },
          "100%": { transform: "translateY(-80px) rotate(540deg) scale(0)", opacity: "0" },
        },
        "stripe-flow": {
          "0%": { backgroundPosition: "0% 50%" },
          "100%": { backgroundPosition: "200% 50%" },
        },
        "spring-in": {
          "0%": { transform: "scale(0.8)", opacity: "0" },
          "70%": { transform: "scale(1.05)" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shine: {
          "0%": { transform: "translateX(-200%) skewX(-12deg)" },
          "100%": { transform: "translateX(200%) skewX(-12deg)" },
        },
        "bounce-soft": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-4px)" },
        },
        "spin-slow": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
        "float-up": {
          "0%": { transform: "translateY(0) scale(0)", opacity: "0" },
          "50%": { opacity: "1" },
          "100%": { transform: "translateY(-100px) scale(1)", opacity: "0" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        slideInLeft: {
          from: { opacity: "0", transform: "translateX(-10px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        slideDown: {
          from: { opacity: "0", transform: "translateY(-10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        messageSlideIn: {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        float: "float 3s ease-in-out infinite",
        breathe: "breathe 2.5s ease-in-out infinite alternate",
        "timer-pulse": "timer-pulse 1s ease-in-out infinite",
        burst: "burst 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        typewriter: "typewriter 0.3s ease-out forwards",
        "confetti-burst": "confetti-burst 0.8s ease-out forwards",
        "stripe-flow": "stripe-flow 3s linear infinite",
        "spring-in": "spring-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        "slide-up": "slide-up 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards",
        shine: "shine 2s ease-in-out infinite",
        "bounce-soft": "bounce-soft 3s ease-in-out infinite",
        "spin-slow": "spin-slow 3s linear infinite",
        "float-up": "float-up 1.5s ease-out forwards",
        fadeIn: "fadeIn 0.3s ease-out forwards",
        slideInLeft: "slideInLeft 0.3s ease-out forwards",
        slideDown: "slideDown 0.2s ease-out forwards",
        messageSlideIn: "messageSlideIn 0.3s ease-out forwards",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
