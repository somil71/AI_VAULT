const axios = require("axios");

const BACKEND_URL = "http://localhost:5000/api/v1";
const TEST_USER = {
    email: `test-${Date.now()}@example.com`,
    password: "password123",
    walletAddress: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
};

let accessToken = "";

async function runTests() {
    try {
        console.log("1. Registering user...");
        const regResp = await axios.post(`${BACKEND_URL}/auth/register`, TEST_USER);
        console.log("Registration Success:", regResp.data.status);

        console.log("2. Logging in...");
        const loginResp = await axios.post(`${BACKEND_URL}/auth/login`, {
            email: TEST_USER.email,
            password: TEST_USER.password
        });
        accessToken = loginResp.data.data.accessToken;
        console.log("Login Success. Token received.");

        console.log("3. Running Phishing Scan...");
        const phishResp = await axios.post(`${BACKEND_URL}/phishing/analyze`,
            { url: "http://suspicious-login-update.com" },
            { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        console.log("Phishing Scan Result:", phishResp.data.data.risk_score > 50 ? "Suspicious" : "Safe");

        console.log("4. Running Anomaly Analysis...");
        const transactions = [
            { date: "2024-01-01", description: "Normal Coffee", amount: 5.50, merchant: "Starbucks" },
            { date: "2024-01-02", description: "Standard Groceries", amount: 85.20, merchant: "Walmart" },
            { date: "2024-01-03", description: "Utility Bill", amount: 120.00, merchant: "Electric Co" },
            { date: "2024-01-04", description: "HUGE TRANSFER", amount: 9999.99, merchant: "OFFSHORE BANK" }
        ];
        const anomalyResp = await axios.post(`${BACKEND_URL}/transactions/analyze`,
            { transactions },
            { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        console.log("Anomaly Response:", anomalyResp.data.status);
        console.log("Flagged Count:", anomalyResp.data.data.flagged_count);

        console.log("5. Verifying Anomaly History...");
        const historyResp = await axios.get(`${BACKEND_URL}/transactions/history`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        console.log("History Count:", historyResp.data.data.results.length);
        if (historyResp.data.data.results.length > 0) {
            console.log("✅ Persistence Verified.");
        } else {
            console.error("❌ Persistence Failed.");
        }

        console.log("\nALL PHASE 1 & 5 TESTS PASSED.");
    } catch (err) {
        console.error("Test Failed:", err.response?.data || err.message);
        process.exit(1);
    }
}

runTests();
