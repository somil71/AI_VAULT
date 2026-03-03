/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: {
                    50: "#f0f9ff",
                    100: "#e0f2fe",
                    400: "#38bdf8",
                    500: "#0ea5e9",
                    600: "#0284c7",
                    900: "#0c4a6e",
                },
                accent: {
                    400: "#a78bfa",
                    500: "#8b5cf6",
                    600: "#7c3aed",
                },
                danger: {
                    400: "#f87171",
                    500: "#ef4444",
                    600: "#dc2626",
                },
                success: {
                    400: "#4ade80",
                    500: "#22c55e",
                },
                warning: {
                    400: "#fbbf24",
                    500: "#f59e0b",
                },
                dark: {
                    800: "#0f172a",
                    850: "#0d1424",
                    900: "#080d18",
                    950: "#050a12",
                },
                surface: {
                    100: "#1e293b",
                    200: "#162032",
                    300: "#0f172a",
                },
            },
            fontFamily: {
                sans: ["Inter", "system-ui", "sans-serif"],
                mono: ["JetBrains Mono", "Fira Code", "monospace"],
            },
            animation: {
                "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                "glow": "glow 2s ease-in-out infinite alternate",
                "slide-in": "slideIn 0.3s ease-out",
                "fade-in": "fadeIn 0.4s ease-out",
            },
            keyframes: {
                glow: {
                    from: { boxShadow: "0 0 5px #0ea5e9, 0 0 10px #0ea5e9" },
                    to: { boxShadow: "0 0 20px #0ea5e9, 0 0 40px #0ea5e9" },
                },
                slideIn: {
                    from: { transform: "translateX(-20px)", opacity: "0" },
                    to: { transform: "translateX(0)", opacity: "1" },
                },
                fadeIn: {
                    from: { opacity: "0", transform: "translateY(10px)" },
                    to: { opacity: "1", transform: "translateY(0)" },
                },
            },
            backgroundImage: {
                "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
                "cyber-grid": "linear-gradient(rgba(14,165,233,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(14,165,233,0.05) 1px, transparent 1px)",
            },
        },
    },
    plugins: [],
};
