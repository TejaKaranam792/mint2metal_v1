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
         (Tether Gold tier)
      ============================ */
      colors: {
        /* ---- Base Backgrounds ---- */
        background: "#0c0c0c",          // dark grey almost black
        surface: "#111111",             // slightly lighter card bg
        "surface-elevated": "#1a1a1a",  // hover states
        "surface-hover": "#222222",     

        /* ---- Borders ---- */
        border: "#262626",              
        "border-strong": "#404040",     
        "border-subtle": "#171717",     

        /* ---- Text ---- */
        "primary-text": "#fdfdfd",      // white text
        "secondary-text": "#a3a3a3",    // muted grey text
        "muted-text": "#737373",        

        /* ---- Primary Accent (Silver) ---- */
        primary: "#e2e8f0",             // m2m silver
        "primary-strong": "#f8fafc",    // bright silver
        "primary-muted": "#94a3b8",     // muted silver
        silver: "#e2e8f0",              // silver accent

        /* ---- Neutrals ---- */
        secondary: "#171717",           
        muted: "#0f0f0f",               

        /* ---- Status (Muted, Professional) ---- */
        success: "#16A34A",             
        warning: "#D97706",             
        error: "#DC2626",               
        info: "#475569",                

        /* ---- Utility ---- */
        overlay: "rgba(0,0,0,0.8)",
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
