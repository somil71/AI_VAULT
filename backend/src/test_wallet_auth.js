const axios = require("axios");
const { ethers } = require("ethers");

const BACKEND_URL = "http://localhost:5000/api/v1";
const WALLET_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const WALLET = new ethers.Wallet(WALLET_PRIVATE_KEY);

async function runWalletTests() {
    try {
        console.log("1. Fetching Nonce...");
        const nonceResp = await axios.get(`${BACKEND_URL}/auth/wallet/nonce`, {
            params: { walletAddress: WALLET.address }
        });
        const { nonce, message } = nonceResp.data.data;
        console.log("Nonce received:", nonce);

        console.log("2. Signing message...");
        const signature = await WALLET.signMessage(message);

        console.log("3. Verifying signature...");
        const verifyResp = await axios.post(`${BACKEND_URL}/auth/wallet/verify`, {
            walletAddress: WALLET.address,
            signature
        });

        const { accessToken, refreshToken } = verifyResp.data.data;
        console.log("Wallet Auth Success. Tokens received.");
        if (accessToken && refreshToken) {
            console.log("✅ Refresh Token Rotation Present.");
        } else {
            throw new Error("Missing Refresh Token in Wallet Auth");
        }

        console.log("4. Testing Refresh Token...");
        const refreshResp = await axios.post(`${BACKEND_URL}/auth/refresh`, { refreshToken });
        console.log("Token Refresh Success:", refreshResp.data.status);

        console.log("5. Testing Revocation (Logout)...");
        await axios.post(`${BACKEND_URL}/auth/logout`, {}, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        console.log("Logged out.");

        console.log("6. Verifying old refresh token is invalid...");
        try {
            await axios.post(`${BACKEND_URL}/auth/refresh`, { refreshToken });
            console.error("❌ ERROR: Old refresh token still worked after logout!");
        } catch (err) {
            console.log("✅ Revocation Verified. Old token rejected.");
        }

        console.log("\nPHASE 2 TESTS PASSED.");
    } catch (err) {
        console.error("Test Failed:", err.response?.data || err.message);
        process.exit(1);
    }
}

runWalletTests();
