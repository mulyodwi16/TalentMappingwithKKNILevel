/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#6366f1", 50: "#eef2ff", 100: "#e0e7ff", 200: "#c7d2fe", 400: "#818cf8", 500: "#6366f1", 600: "#4f46e5", 700: "#4338ca" },
        tosca: { DEFAULT: "#8b5cf6", 500: "#8b5cf6", 600: "#7c3aed" },
      },
      fontFamily: { sans: ["Inter", "Plus Jakarta Sans", "sans-serif"] },
      boxShadow: { soft: "0 2px 15px -3px rgba(0,0,0,0.07), 0 10px 20px -2px rgba(0,0,0,0.04)" },
    },
  },
  plugins: [],
};
