/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#2563eb", 50: "#eff6ff", 100: "#dbeafe", 500: "#3b82f6", 600: "#2563eb", 700: "#1d4ed8" },
        tosca: { DEFAULT: "#0ea5e9", 500: "#0ea5e9", 600: "#0284c7" },
      },
      fontFamily: { sans: ["Inter", "Plus Jakarta Sans", "sans-serif"] },
      boxShadow: { soft: "0 2px 15px -3px rgba(0,0,0,0.07), 0 10px 20px -2px rgba(0,0,0,0.04)" },
    },
  },
  plugins: [],
};
