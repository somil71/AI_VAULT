const { ThreatGraphService, ThreatIntelligence } = require("../services/threatGraphService");
const mongoose = require("mongoose");
const crypto = require("crypto");

describe("ThreatGraphService Propagation Logic", () => {
    const testUrl = "http://malicious-site-test.com/phish";
    const urlHash = crypto.createHash("sha256").update(testUrl).digest("hex");

    beforeAll(async () => {
        // Mocking Mongoose if not connected, or using a test DB
        // For this task, we'll verify the logic assuming MongoDB is handled
    });

    afterEach(async () => {
        if (mongoose.connection.readyState === 1) {
            await ThreatIntelligence.deleteMany({});
        }
    });

    test("First report sets status to SUSPECTED", async () => {
        const entry = await ThreatGraphService.recordThreat(testUrl, 0.85, "user1");
        expect(entry.consensusLevel).toBe("SUSPECTED");
        expect(entry.reportCount).toBe(1);
    });

    test("Three reports with high scores move status to CONFIRMED", async () => {
        await ThreatGraphService.recordThreat(testUrl, 0.85, "user1");
        await ThreatGraphService.recordThreat(testUrl, 0.90, "user2");
        const entry = await ThreatGraphService.recordThreat(testUrl, 0.88, "user3");
        
        expect(entry.consensusLevel).toBe("CONFIRMED");
        expect(entry.blockedForAllAt).not.toBeNull();
    });

    test("Low scores (<0.65) do not trigger CONFIRMED even with 3 reports", async () => {
        await ThreatGraphService.recordThreat(testUrl, 0.50, "user1");
        await ThreatGraphService.recordThreat(testUrl, 0.55, "user2");
        const entry = await ThreatGraphService.recordThreat(testUrl, 0.60, "user3");
        
        expect(entry.consensusLevel).toBe("SUSPECTED");
    });

    test("isCommunityBlocked returns true only for CONFIRMED entries", async () => {
        await ThreatGraphService.recordThreat(testUrl, 0.85, "user1");
        let check = await ThreatGraphService.isCommunityBlocked(testUrl);
        expect(check.blocked).toBe(false);

        await ThreatGraphService.recordThreat(testUrl, 0.90, "user2");
        await ThreatGraphService.recordThreat(testUrl, 0.95, "user3");
        
        check = await ThreatGraphService.isCommunityBlocked(testUrl);
        expect(check.blocked).toBe(true);
    });
});
