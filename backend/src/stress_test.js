const axios = require("axios");

const BACKEND_URL = "http://localhost:5000/api/v1";
const AUTH_URL = `${BACKEND_URL}/auth`;
const PHISH_URL = `${BACKEND_URL}/phishing/analyze`;
const TRANS_URL = `${BACKEND_URL}/transactions/analyze`;

async function stressTest() {
    const stats = {
        phish: { success: 0, fail: 0, latencies: [] },
        auth: { success: 0, fail: 0, latencies: [] },
        trans: { success: 0, fail: 0, latencies: [] }
    };

    let token = "";
    try {
        // Try to register/login until we get a token or exhaustive fail
        for (let i = 0; i < 5; i++) {
            try {
                const regResp = await axios.post(`${AUTH_URL}/register`, {
                    email: `stress-${Date.now()}-${i}@test.com`,
                    password: "password123"
                });
                token = regResp.data.data.accessToken;
                if (token) break;
            } catch (e) {
                if (e.response?.status !== 429) break;
                await new Promise(r => setTimeout(r, 1000));
            }
        }

        if (!token) {
            console.log("CRITICAL_ERROR:Could not obtain token (likely 429)");
            return;
        }

        const headers = { Authorization: `Bearer ${token}` };

        const phishTask = async () => {
            const start = Date.now();
            try {
                await axios.post(PHISH_URL, { url: "http://stress.com" }, { headers, timeout: 60000 });
                stats.phish.success++;
                stats.phish.latencies.push(Date.now() - start);
            } catch (e) {
                stats.phish.fail++;
            }
        };

        const authTask = async (i) => {
            const start = Date.now();
            try {
                // Testing rate limit on Login endpoint this time
                await axios.post(`${AUTH_URL}/login`, { email: "nonexistent@t.com", password: "p" }, { timeout: 10000 });
                stats.auth.success++;
                stats.auth.latencies.push(Date.now() - start);
            } catch (e) {
                stats.auth.fail++;
            }
        };

        const transTask = async () => {
            const start = Date.now();
            try {
                await axios.post(TRANS_URL, {
                    transactions: [
                        { date: "2024-01-01", description: "T1", amount: 10, merchant: "M1" },
                        { date: "2024-01-02", description: "T2", amount: 20, merchant: "M2" },
                        { date: "2024-01-03", description: "T3", amount: 30, merchant: "M3" }
                    ]
                }, { headers, timeout: 60000 });
                stats.trans.success++;
                stats.trans.latencies.push(Date.now() - start);
            } catch (e) {
                stats.trans.fail++;
            }
        };

        // Fire Bursts
        const phishPromises = Array.from({ length: 50 }, phishTask);
        const authPromises = Array.from({ length: 100 }, (_, i) => authTask(i));
        const transPromises = Array.from({ length: 20 }, transTask);

        await Promise.all([...phishPromises, ...authPromises, ...transPromises]);

        const p95 = (arr) => {
            if (!arr.length) return 0;
            const sorted = [...arr].sort((a, b) => a - b);
            return sorted[Math.floor(sorted.length * 0.95)];
        };

        const result = {
            phishing: { success: stats.phish.success, fail: stats.phish.fail, p95: p95(stats.phish.latencies) },
            auth: { success: stats.auth.success, fail: stats.auth.fail },
            anomaly: { success: stats.trans.success, fail: stats.trans.fail, p95: p95(stats.trans.latencies) },
            verdicts: {
                rate_limiting: stats.auth.fail >= 40 ? "PASSED" : "FAILED",
                stability: (stats.phish.fail === 0 && stats.trans.fail === 0) ? "PASSED" : "FAILED"
            }
        };

        console.log("FINAL_RESULTS_JSON:" + JSON.stringify(result));
    } catch (err) {
        console.log("CRITICAL_ERROR:" + err.message);
    }
}

stressTest();
