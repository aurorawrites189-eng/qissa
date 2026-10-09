import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        // System fonts: Noto Nastaliq Urdu falls back for Urdu text on most OSes.
        sans: ["system-ui", "-apple-system", "Segoe UI", "Noto Sans", "Noto Nastaliq Urdu", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
