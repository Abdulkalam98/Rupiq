import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0A0A0F",
        paper: "#F5F2EB",
        green: { DEFAULT: "#00C27C", light: "rgba(0,194,124,0.08)" },
        lime: "#C8F135",
        orange: "#FF5C2E",
        blue: { DEFAULT: "#4A9EFF", light: "rgba(74,158,255,0.08)" },
        purple: "#9B6DFF",
        muted: "#6B6B7A",
        border: "#E2DED5",
      },
      fontFamily: {
        display: ["Syne", "sans-serif"],
        mono: ["DM Mono", "monospace"],
        sans: ["DM Sans", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
