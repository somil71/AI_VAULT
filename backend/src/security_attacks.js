const axios = require("axios");
const { ethers } = require("ethers");

const BACKEND_URL = "http://localhost:5000/api/v1";
const WALLET_PRIV = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const WALLET = new ethers.Wallet(WALLET_PRIV);

async function runSecurityAttacks() {
    console.log("🛠️ STARTING SECURITY ATTACK SIMULATION...");
    const results = [];

    // Helper for obtaining token with retry for 429
    async function getAuthToken(email) {
        for (let i = 0; i < 5; i++) {
            try {
                const reg = await axios.post(`${BACKEND_URL}/auth/register`, { email, password: "p" });
                return reg.data.data.accessToken;
            } catch (e) {
                if (e.response?.status === 429) {
                    await new Promise(r => setTimeout(r, 2000));
                    continue;
                }
                throw e;
            }
        }
        throw new Error("Failed to get token due to throttling");
    }

    // 1. JWT Tampering
    try {
        console.log("Test: JWT Tampering...");
        const token = await getAuthToken(`attack-${Date.now()}@t.com`);
        const tamperedToken = token.substring(0, token.length - 10) + "tampered12";
        await axios.get(`${BACKEND_URL}/auth/me`, { headers: { Authorization: `Bearer ${tamperedToken}` } });
        results.push("❌ FAIL: JWT Tampering accepted tampered token");
    } catch (e) {
        if (e.response?.status === 401) {
            results.push("✅ PASS: JWT Tampering blocked");
        } else {
            results.push(`❌ FAIL: JWT Tampering got unexpected status ${e.response?.status}`);
        }
    }

    // 2. Replay Nonce Attack
    try {
        console.log("Test: Wallet Nonce Replay...");
        const nResp = await axios.get(`${BACKEND_URL}/auth/wallet/nonce`, { params: { walletAddress: WALLET.address } });
        const { message } = nResp.data.data;
        const sig = await WALLET.signMessage(message);

        // First use: Should pass
        await axios.post(`${BACKEND_URL}/auth/wallet/verify`, { walletAddress: WALLET.address, signature: sig });

        // Second use (Replay): Should fail
        await axios.post(`${BACKEND_URL}/auth/wallet/verify`, { walletAddress: WALLET.address, signature: sig });
        results.push("❌ FAIL: Nonce Replay attack succeeded");
    } catch (e) {
        if (e.response?.status === 409 || e.response?.status === 400 || e.response?.status === 429) {
            results.push(`✅ PASS: Nonce Replay attack blocked (Status: ${e.response?.status})`);
        } else {
            results.push(`❌ FAIL: Nonce Replay got unexpected status ${e.response?.status}`);
        }
    }

    // 3. Unauthorized History Access (Cross-user isolation)
    try {
        console.log("Test: Cross-user History Isolation...");
        const t1 = await getAuthToken(`u1-${Date.now()}@t.com`);
        const t2 = await getAuthToken(`u2-${Date.now()}@t.com`);

        // U1 creates an anomaly result
        await axios.post(`${BACKEND_URL}/transactions/analyze`, {
            transactions: [
                { date: "2024-01-01", description: "T", amount: 1, merchant: "M" },
                { date: "2024-01-01", description: "T", amount: 1, merchant: "M" },
                { date: "2024-01-01", description: "T", amount: 1, merchant: "M" }
            ]
        }, { headers: { Authorization: `Bearer ${t1}` } });

        // U2 tries to read history
        const h2 = await axios.get(`${BACKEND_URL}/transactions/history`, { headers: { Authorization: `Bearer ${t2}` } });

        if (h2.data.data.results.length === 0) {
            results.push("✅ PASS: User isolation verified (History empty for U2)");
        } else {
            results.push("❌ FAIL: User isolation breached (U2 saw U1 results)");
        }
    } catch (e) {
        results.push(`❌ FAIL: History test error: ${e.response?.data?.message || e.message}`);
    }

    console.log("\n🧪 ATTACK VERDICT SUMMARY:");
    results.forEach(r => console.log(r));
}

runSecurityAttacks();
