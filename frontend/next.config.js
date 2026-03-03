/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    env: {
        NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000",
        NEXT_PUBLIC_RPC_URL: process.env.NEXT_PUBLIC_RPC_URL || "http://127.0.0.1:8545",
        NEXT_PUBLIC_IDENTITY_CONTRACT: process.env.NEXT_PUBLIC_IDENTITY_CONTRACT || "",
        NEXT_PUBLIC_VAULT_CONTRACT: process.env.NEXT_PUBLIC_VAULT_CONTRACT || "",
        NEXT_PUBLIC_EMERGENCY_CONTRACT: process.env.NEXT_PUBLIC_EMERGENCY_CONTRACT || "",
        NEXT_PUBLIC_VERIFIER_CONTRACT: process.env.NEXT_PUBLIC_VERIFIER_CONTRACT || "",
    },
};

module.exports = nextConfig;
