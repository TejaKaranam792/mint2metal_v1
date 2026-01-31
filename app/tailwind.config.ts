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
        background: "#020617",          // true near-black
        surface: "#0A0F1F",             // cards
        "surface-elevated": "#111827",  // modals, sheets
        "surface-hover": "#141A2E",

        /* ---- Borders ---- */
        border: "#1E293B",
        "border-strong": "#334155",
        "border-subtle": "#0F172A",

        /* ---- Text ---- */
        "primary-text": "#F8FAFC",      // platinum white
        "secondary-text": "#9CA3AF",    // soft silver
        "muted-text": "#6B7280",        // metadata / labels

        /* ---- Primary Accent (Silver / Platinum) ---- */
        primary: "#E5E7EB",             // main CTA / highlights
        "primary-strong": "#F9FAFB",    // strong CTA
        "primary-muted": "#9CA3AF",     // disabled / subtle

        /* ---- Neutrals ---- */
        secondary: "#1F2937",           // graphite
        muted: "#374151",

        /* ---- Status (Muted, Institutional) ---- */
        success: "#16A34A",             // compliance green
        warning: "#D97706",             // amber
        error: "#DC2626",               // deep red
        info: "#64748B",                // slate info

        /* ---- Utility ---- */
        overlay: "rgba(0,0,0,0.65)",
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
