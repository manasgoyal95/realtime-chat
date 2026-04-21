/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          50: "#f6f7f9",
          100: "#ebedf2",
          200: "#d2d6e0",
          300: "#a7afc2",
          400: "#7a8299",
          500: "#525a6e",
          600: "#3b4253",
          700: "#2a2f3c",
          800: "#1c2029",
          900: "#12141a",
        },
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Inter",
          "sans-serif",
        ],
      },
      animation: {
        "pulse-dot": "pulse-dot 1.4s infinite ease-in-out both",
      },
      keyframes: {
        "pulse-dot": {
          "0%, 80%, 100%": { transform: "scale(0)" },
          "40%": { transform: "scale(1)" },
        },
      },
    },
  },
  plugins: [],
};
