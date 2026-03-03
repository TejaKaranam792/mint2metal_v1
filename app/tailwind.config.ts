import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },

      /* ============================
         PREMIUM INSTITUTIONAL COLORS
         (Paxos / Coinbase Prime tier)
      ============================ */
      colors: {
        /* ---- Base Backgrounds ---- */
        background: "#FFFFFF",          // pure white
        surface: "#F8FAFC",             // very light gray (slate-50)
        "surface-elevated": "#F1F5F9",  // light gray (slate-100)
        "surface-hover": "#E2E8F0",     // slate-200

        /* ---- Borders ---- */
        border: "#E2E8F0",              // slate-200
        "border-strong": "#CBD5E1",     // slate-300
        "border-subtle": "#F1F5F9",     // slate-100

        /* ---- Text ---- */
        "primary-text": "#0F172A",      // slate-900
        "secondary-text": "#475569",    // slate-600
        "muted-text": "#94A3B8",        // slate-400

        /* ---- Primary Accent (Simple / Clean) ---- */
        primary: "#0F172A",             // slate-900 (high contrast)
        "primary-strong": "#020617",    // almost black
        "primary-muted": "#94A3B8",     // slate-400

        /* ---- Neutrals ---- */
        secondary: "#F1F5F9",           // slate-100
        muted: "#F8FAFC",               // slate-50

        /* ---- Status (Muted, Professional) ---- */
        success: "#16A34A",             // green-600
        warning: "#D97706",             // amber-600
        error: "#DC2626",               // red-600
        info: "#475569",                // slate-600

        /* ---- Utility ---- */
        overlay: "rgba(255,255,255,0.8)",
      },

      /* ============================
         SPACING (DASHBOARD SCALE)
      ============================ */
      spacing: {
        "18": "4.5rem",
        "22": "5.5rem",
        "88": "22rem",
        "96": "24rem",
        "128": "32rem",
      },

      /* ============================
         BORDER RADIUS (SUBTLE, PRO)
      ============================ */
      borderRadius: {
        sm: "0.375rem",
        md: "0.5rem",
        lg: "0.75rem",
        xl: "1rem",
        "2xl": "1.25rem",
      },

      /* ============================
         SHADOWS (REALISTIC DEPTH)
      ============================ */
      boxShadow: {
        sm: "0 1px 2px rgba(0,0,0,0.35)",
        md: "0 6px 14px rgba(0,0,0,0.4)",
        lg: "0 14px 28px rgba(0,0,0,0.5)",
        xl: "0 30px 60px rgba(0,0,0,0.65)",
        inset: "inset 0 1px 0 rgba(255,255,255,0.04)",
      },

      /* ============================
         MOTION (SUBTLE, LUXURY)
      ============================ */
      transitionTimingFunction: {
        "out-expo": "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
