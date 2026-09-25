import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      maxWidth: {
        content: "1200px",
        wide: "1680px",
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent-primary))",
          hover: "hsl(var(--accent-primary-hover))",
          light: "hsl(var(--accent-primary-light))",
          subtle: "hsl(var(--bg-subtle-accent))",
          foreground: "hsl(var(--accent-primary-foreground))",
          primary: "hsl(var(--accent-primary))",
          warm: "hsl(var(--accent-warm))",
        },
        warm: {
          DEFAULT: "hsl(var(--accent-warm))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        "dark-bg": "hsl(var(--dark-bg))",
        "bg-base": "hsl(var(--bg-base))",
        "bg-surface-1": "hsl(var(--bg-surface-1))",
        "bg-surface-2": "hsl(var(--bg-surface-2))",
        "bg-elevated": "hsl(var(--bg-elevated))",
        "bg-subtle-accent": "hsl(var(--bg-subtle-accent))",
        "bg-dark": "hsl(var(--bg-dark))",
        "bg-darkest": "hsl(var(--bg-darkest))",
        "text-primary": "hsl(var(--text-primary))",
        "text-secondary": "hsl(var(--text-secondary))",
        "text-tertiary": "hsl(var(--text-tertiary))",
        "text-on-dark": "hsl(var(--text-on-dark))",
        "text-on-dark-muted": "hsl(var(--text-on-dark-muted))",
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 4px)",
        sm: "calc(var(--radius) - 8px)",
        "2xl": "1rem",
      },
      boxShadow: {
        "elevation-1": "0 1px 2px rgba(26,26,46,0.04)",
        "elevation-2": "0 2px 8px rgba(26,26,46,0.05)",
        "elevation-3": "0 4px 16px rgba(26,26,46,0.07)",
        "elevation-4": "0 8px 32px rgba(26,26,46,0.09)",
        "elevation-5": "0 16px 48px rgba(26,26,46,0.12)",
        "accent-glow": "0 4px 16px rgba(99,102,241,0.25)",
        "accent-glow-lg": "0 8px 24px rgba(99,102,241,0.35)",
      },
      keyframes: {
        "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
        "accordion-up": { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
        "fade-up": { "0%": { opacity: "0", transform: "translateY(16px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        "scale-in": { "0%": { opacity: "0", transform: "scale(0.96)" }, "100%": { opacity: "1", transform: "scale(1)" } },
        "star-btn": {
          "0%": { offsetDistance: "0%" },
          "100%": { offsetDistance: "100%" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-up": "fade-up 0.6s ease-out",
        "scale-in": "scale-in 0.4s ease-out",
        "star-btn": "star-btn calc(var(--duration)*1s) linear infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
