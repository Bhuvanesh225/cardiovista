/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Manrope", "Inter", "system-ui", "sans-serif"],
      },
      colors: {
        // CardioVista design system (Styles/cardiovista.ds)
        primary: {
          DEFAULT: "#3D7DFF",
          fg: "#04122b",
        },
        secondary: {
          DEFAULT: "#14C8B4",
          fg: "#04122b",
        },
        canvas: "#0A0E17",
        surface: {
          DEFAULT: "#0F1420",
          container: "#161C2B",
          raised: "#1D2537",
        },
        line: "#242C3D",
        success: "#00C950",
        warning: "#FF6900",
        error: "#FB2C36",
        info: "#2B7FFF",
        tissue: "#EDE6DB",
        muted: "#8A94A6",
      },
      borderRadius: {
        xl: "12px",
        "2xl": "16px",
      },
      boxShadow: {
        panel: "0 1px 0 rgba(255,255,255,0.03) inset, 0 12px 32px -18px rgba(0,0,0,0.9)",
        glow: "0 0 0 3px rgba(61,125,255,0.25)",
      },
      keyframes: {
        pulseRed: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.45" },
        },
      },
      animation: {
        "pulse-red": "pulseRed 1.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};