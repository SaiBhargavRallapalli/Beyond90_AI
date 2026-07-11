import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      colors: {
        primary: {
          50:  "#EEF0F5",
          100: "#D5DAE6",
          200: "#ABB4CD",
          300: "#808FB4",
          400: "#556A9B",
          500: "#334E82",
          600: "#1E3669",
          700: "#142550",
          800: "#0D1B3E",
          900: "#0A1628",
          950: "#060D18",
        },
        accent: {
          50:  "#FDF8EC",
          100: "#F9EDD0",
          200: "#F3D9A1",
          300: "#ECC472",
          400: "#E4AE43",
          500: "#C9A84C",
          600: "#AA8A2E",
          700: "#8A6E1C",
          800: "#6A5210",
          900: "#4A3A08",
          950: "#2A2004",
        },
        emerald: {
          50:  "#E0FFF9",
          100: "#B3FFF0",
          200: "#7FFFE5",
          300: "#3DFFDA",
          400: "#00F5C4",
          500: "#00D4AA",
          600: "#00A887",
          700: "#007D64",
          800: "#005243",
          900: "#002D24",
          950: "#001812",
        },
        stadium: {
          50:  "#FDE8EB",
          100: "#FAC5CF",
          200: "#F59AAF",
          300: "#EC6F8F",
          400: "#E0446F",
          500: "#D12050",
          600: "#C41E3A",
          700: "#9E1730",
          800: "#780F23",
          900: "#520717",
          950: "#33010C",
        },
      },
      keyframes: {
        fadeIn: {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%":   { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseGlow: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(201, 168, 76, 0)" },
          "50%":       { boxShadow: "0 0 20px 6px rgba(201, 168, 76, 0.4)" },
        },
      },
      animation: {
        "fade-in":    "fadeIn 0.4s ease-out both",
        "slide-up":   "slideUp 0.5s ease-out both",
        "pulse-glow": "pulseGlow 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
