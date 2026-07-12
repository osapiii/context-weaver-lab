/** @type {import('tailwindcss').Config} */
const tailwindMdBase = require("@geoffcodesthings/tailwind-md-base");

module.exports = {
  darkMode: false,
  content: [
    "./app.vue",
    "./components/**/*.{vue,js,ts}",
    "./layouts/**/*.vue",
    "./pages/**/*.vue",
    "./plugins/**/*.{js,ts}",
    "./stores/**/*.ts",
    "./composables/**/*.ts",
  ],
  theme: {
    extend: {
      width: {
        "1/2": "50%",
        "1/3": "33.333333%",
        "2/3": "66.666666%",
        "1/4": "25%",
        "1/5": "20%",
        "2/5": "40%",
      },
      colors: {
        warning: {
          50: "#fffbeb",
          100: "#fef3c7",
          200: "#fde68a",
          300: "#fcd94d",
          400: "#fbd024",
          500: "#f5c60b",
          600: "#d9af06",
          700: "#b49209",
          800: "#92780e",
          900: "#78630f",
          950: "#453803",
        },
        success: {
          50: "#ecfdf4",
          100: "#d1fae5",
          200: "#a7f3cc",
          300: "#6ee7a9",
          400: "#34d382",
          500: "#10b962",
          600: "#05964c",
          700: "#04783d",
          800: "#065f31",
          900: "#064e29",
          950: "#022c16",
        },
        info: {
          50: "#f2f9f9",
          100: "#ddeff0",
          200: "#bfe0e2",
          300: "#92cace",
          400: "#5faab1",
          500: "#438e96",
          600: "#3b757f",
          700: "#356169",
          800: "#325158",
          900: "#2d464c",
          950: "#1a2c32",
        },
        error: {
          50: "#fef2f2",
          100: "#ffe1e1",
          200: "#ffc8c8",
          300: "#ffa3a3",
          400: "#fd6c6c",
          500: "#f53e3e",
          600: "#e22020",
          700: "#be1717",
          800: "#9d1717",
          900: "#821a1a",
          950: "#470808",
        },
        background: {
          50: "#ffffff",
          100: "#efefef",
          200: "#dcdcdc",
          300: "#bdbdbd",
          400: "#989898",
          500: "#7c7c7c",
          600: "#656565",
          700: "#525252",
          800: "#464646",
          900: "#3d3d3d",
          950: "#292929",
        },
      },
    },
    markdownBase: {
      h1: {
        fontSize: "1.5rem",
      },
      h2: {
        fontSize: "1.25rem",
      },
      h3: {
        fontSize: "1.125rem",
      },
      h4: {
        fontSize: "1.0rem",
      },
      h5: {
        fontSize: "0.875rem",
      },
      h6: {
        fontSize: "0.75rem",
      },
      a: {
        color: "#6b7280",
        textDecoration: "underline",
        target: "_blank",
        "&:hover": {
          color: "#4b5563",
          textDecoration: "underline",
        },
      },
    },
  },
  plugins: [require("@tailwindcss/container-queries"), tailwindMdBase()],
};
