/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0b0a09", ink2: "#151311", rule: "#2b2824", fg: "#eeebe6", mute: "#a39c93", dim: "#7d8794",
        signal: "#f1b23c", good: "#3fb950", bad: "#f28b7d", violet: "#b46eff", pink: "#ff5f96", orange: "#ff9646"
      },
      fontFamily: {
        display: ["Archivo", '"Helvetica Neue"', "Arial", "sans-serif"],
        sans: ['"Source Sans 3"', '"Segoe UI"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', '"Cascadia Mono"', "Consolas", "ui-monospace", "monospace"]
      }
    }
  },
  plugins: []
};
