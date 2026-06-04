/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        sage: "#5a7a60",
        rust: "#8b4a3a",
        slate: "#4a6070",
        stone: "#8b7355",
        page: "#f7f5f0",
        surface: "#f0ede6",
        card: "#faf9f6",
        ink: "#1a1a18",
      },
      fontFamily: {
        serif: ["Lora", "serif"],
        sans: ["DM Sans", "sans-serif"],
        mono: ["DM Mono", "monospace"],
      },
    },
  },
  plugins: [],
};