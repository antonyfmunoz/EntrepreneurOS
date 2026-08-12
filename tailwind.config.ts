import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
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
          hover: "#5a2dc0",
          muted: "#eee8ff",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
          hover: "#58409c",
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
          muted: "#fcebea",
        },
        border: {
          DEFAULT: "hsl(var(--border))",
          subtle: "rgba(171, 173, 174, 0.10)",
        },
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        surface: {
          DEFAULT: "#ffffff",
          elevated: "#ffffff",
          subtle: "#eff1f2",
        },
        text: {
          DEFAULT: "#2c2f30",
          secondary: "#595c5d",
          tertiary: "#7a7d7e",
          "on-primary": "#ffffff",
        },
        success: {
          DEFAULT: "#2d7d5f",
          muted: "#e5f3ed",
        },
        warning: {
          DEFAULT: "#9a6700",
          muted: "#fbf1d6",
        },
        error: "#b42318",
        chart: {
          "1": "#6a37d4",
          "2": "#6448b2",
          "3": "#ae8dff",
          "4": "#4e8a79",
          "5": "#b37a2d",
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
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        mono: ["Inter", "system-ui", "sans-serif"],
      },
      fontSize: {
        xs: ["0.6875rem", { lineHeight: "1.5" }],
        sm: ["0.8125rem", { lineHeight: "1.6" }],
        base: ["0.9375rem", { lineHeight: "1.6" }],
        lg: ["1.0625rem", { lineHeight: "1.6" }],
        xl: ["1.25rem", { lineHeight: "1.4" }],
        "2xl": ["1.625rem", { lineHeight: "1.25" }],
        "3xl": ["2.25rem", { lineHeight: "1.15" }],
        "4xl": ["3.5rem", { lineHeight: "1.05" }],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "16px",
        "2xl": "20px",
      },
      boxShadow: {
        sm: "0 4px 16px rgba(106, 55, 212, 0.05)",
        md: "0 8px 32px rgba(106, 55, 212, 0.08)",
        lg: "0 16px 48px rgba(106, 55, 212, 0.10)",
        xl: "0 24px 64px rgba(106, 55, 212, 0.12)",
        focus: "0 0 0 4px rgba(106, 55, 212, 0.12)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
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
