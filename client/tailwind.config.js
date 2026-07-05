/** @type {import('tailwindcss').Config} */
// Warna brand & tosca memakai CSS variable (RGB triplet) agar bisa diganti runtime
// (kustomisasi warna aksen di dropdown profil). Nilai default & preset ada di index.css.
const brandVar = (n) => `rgb(var(--brand-${n}) / <alpha-value>)`;
const toscaVar = (n) => `rgb(var(--tosca-${n}) / <alpha-value>)`;
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: brandVar(500), 50: brandVar(50), 100: brandVar(100), 200: brandVar(200), 400: brandVar(400), 500: brandVar(500), 600: brandVar(600), 700: brandVar(700) },
        tosca: { DEFAULT: toscaVar(500), 500: toscaVar(500), 600: toscaVar(600) },
      },
      fontFamily: { sans: ["Inter", "Plus Jakarta Sans", "sans-serif"] },
      boxShadow: { soft: "0 2px 15px -3px rgba(0,0,0,0.07), 0 10px 20px -2px rgba(0,0,0,0.04)" },
    },
  },
  plugins: [],
};
