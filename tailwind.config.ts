import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
            "primary": {
                  "DEFAULT": "#0047FF",
                  "hover": "#0038CC",
                  "muted": "#E6EEFF"
            },
            "secondary": {
                  "DEFAULT": "#FF3D00",
                  "hover": "#CC3100"
            },
            "success": {
                  "DEFAULT": "#00C853",
                  "muted": "#E8F5E9"
            },
            "warning": {
                  "DEFAULT": "#FFB300",
                  "muted": "#FFF8E1"
            },
            "destructive": {
                  "DEFAULT": "#D32F2F",
                  "muted": "#FFEBEE"
            },
            "background": "#FAFAFA",
            "surface": {
                  "DEFAULT": "#FFFFFF",
                  "elevated": "#FFFFFF",
                  "subtle": "#F5F5F5"
            },
            "border": {
                  "DEFAULT": "#E0E0E0",
                  "subtle": "#F0F0F0"
            },
            "text": {
                  "DEFAULT": "#0A0A0A",
                  "secondary": "#616161",
                  "tertiary": "#9E9E9E",
                  "on-primary": "#FFFFFF"
            },
            "ring": "#0047FF"
      },
      fontFamily: {
            "mono": [
                  "IBM Plex Mono",
                  "Geist Mono",
                  "monospace"
            ],
            "sans": [
                  "IBM Plex Mono",
                  "Geist Mono",
                  "monospace"
            ]
      },
      fontSize: {
            "xs": "0.6875rem",
            "sm": "0.8125rem",
            "base": "0.9375rem",
            "lg": "1.0625rem",
            "xl": "1.25rem",
            "2xl": "1.625rem",
            "3xl": "2.25rem",
            "4xl": "3.5rem"
      },
      borderRadius: {
            "none": "0",
            "sm": "0.125rem",
            "md": "0.25rem",
            "lg": "0.5rem",
            "xl": "0.75rem",
            "2xl": "1rem"
      },
      boxShadow: {
            "sm": "0 1px 2px 0 rgba(0, 71, 255, 0.04)",
            "md": "0 4px 8px -2px rgba(0, 71, 255, 0.08), 0 2px 4px -2px rgba(0, 71, 255, 0.04)",
            "lg": "0 12px 24px -4px rgba(0, 71, 255, 0.12), 0 4px 8px -4px rgba(0, 71, 255, 0.06)",
            "xl": "0 24px 48px -8px rgba(0, 71, 255, 0.16), 0 8px 16px -8px rgba(0, 71, 255, 0.08)",
            "inner": "inset 0 2px 4px 0 rgba(0, 0, 0, 0.05)",
            "focus": "0 0 0 3px rgba(0, 71, 255, 0.12)"
      },
      spacing: {
            "1": "0.25rem",
            "2": "0.5rem",
            "3": "0.75rem",
            "4": "1rem",
            "5": "1.25rem",
            "6": "1.5rem",
            "8": "2rem",
            "10": "2.5rem",
            "12": "3rem",
            "16": "4rem",
            "20": "5rem",
            "24": "6rem",
            "0.5": "0.125rem",
            "1.5": "0.375rem"
      },

      colors: {
            "primary": {
                  "DEFAULT": "#2563eb",
                  "hover": "#1d4ed8",
                  "muted": "#dbeafe"
            },
            "secondary": {
                  "DEFAULT": "#0ea5e9",
                  "hover": "#0284c7"
            },
            "success": {
                  "DEFAULT": "#10b981",
                  "muted": "#d1fae5"
            },
            "warning": {
                  "DEFAULT": "#f59e0b",
                  "muted": "#fef3c7"
            },
            "destructive": {
                  "DEFAULT": "#ef4444",
                  "muted": "#fee2e2"
            },
            "background": "#fafbfc",
            "surface": {
                  "DEFAULT": "#ffffff",
                  "elevated": "#ffffff",
                  "subtle": "#f4f5f7"
            },
            "border": {
                  "DEFAULT": "#d1d5db",
                  "subtle": "#e5e7eb"
            },
            "text": {
                  "DEFAULT": "#111827",
                  "secondary": "#6b7280",
                  "tertiary": "#9ca3af",
                  "on-primary": "#ffffff"
            },
            "ring": "#2563eb"
      },
      fontFamily: {
            "sans": [
                  "Inter",
                  "system-ui",
                  "-apple-system",
                  "sans-serif"
            ]
      },
      fontSize: {
            "xs": "0.6875rem",
            "sm": "0.8125rem",
            "base": "0.9375rem",
            "lg": "1.0625rem",
            "xl": "1.25rem",
            "2xl": "1.625rem",
            "3xl": "2.25rem",
            "4xl": "3.5rem"
      },
      spacing: {
            "0.5": "0.125rem",
            "1.5": "0.375rem"
      },
      borderRadius: {
            "sm": "0.125rem",
            "md": "0.25rem",
            "lg": "0.375rem",
            "xl": "0.5rem",
            "2xl": "0.75rem"
      },
      boxShadow: {
            "sm": "0 1px 2px 0 rgba(17, 24, 39, 0.04)",
            "md": "0 2px 4px -1px rgba(17, 24, 39, 0.06), 0 4px 6px -1px rgba(17, 24, 39, 0.04)",
            "lg": "0 8px 16px -4px rgba(17, 24, 39, 0.08), 0 4px 8px -2px rgba(17, 24, 39, 0.04)",
            "xl": "0 16px 32px -8px rgba(17, 24, 39, 0.12), 0 8px 16px -4px rgba(17, 24, 39, 0.06)",
            "inner": "inset 0 2px 4px 0 rgba(17, 24, 39, 0.04)",
            "focus": "0 0 0 3px rgba(37, 99, 235, 0.12), 0 0 0 1px #2563eb"
      },

      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
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
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;
