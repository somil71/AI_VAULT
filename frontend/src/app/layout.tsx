import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import AppProviders from "@/context/AppProviders";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
    title: "LifeVault AI — Personal AI Guardian for Digital & Financial Safety",
    description: "Secure your digital legacy with LifeVault AI. Real-time phishing detection, Web3 wallet reputation, encrypted vaults, and automated threat reporting.",
    keywords: ["AI security", "Web3 protection", "phishing detection", "crypto safety", "digital vault", "smart contract audit"],
    openGraph: {
        title: "LifeVault AI — Your Personal AI Guardian",
        description: "Advanced AI protection for your digital and financial life.",
        url: "https://lifevault.ai",
        siteName: "LifeVault AI",
        images: [{ url: "/og-image.png", width: 1200, height: 630 }],
        locale: "en_US",
        type: "website",
    },
    twitter: {
        card: "summary_large_image",
        title: "LifeVault AI — Personal AI Guardian",
        description: "AI-powered digital security for the Web3 era.",
        images: ["/og-image.png"],
    },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" className="dark">
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link
                    href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap"
                    rel="stylesheet"
                />
            </head>
            <body className={`${inter.variable} font-sans bg-dark-900 text-white antialiased`}>
                <AppProviders>
                    <Toaster
                        position="top-right"
                        toastOptions={{
                            style: {
                                background: "#1e293b",
                                color: "#f1f5f9",
                                border: "1px solid #334155",
                                borderRadius: "12px",
                            },
                            success: { iconTheme: { primary: "#22c55e", secondary: "#f1f5f9" } },
                            error: { iconTheme: { primary: "#ef4444", secondary: "#f1f5f9" } },
                        }}
                    />
                    {children}
                </AppProviders>
            </body>
        </html>
    );
}
