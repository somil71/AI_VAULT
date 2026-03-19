const { WalletReputationService } = require("../services/walletReputationService");

describe("WalletReputationService Scoring Engine", () => {
    const testAddress = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";

    test("Mocked scoring returns consistent structure", async () => {
        const result = await WalletReputationService.calculateScore(testAddress);
        expect(result.address).toBe(testAddress);
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(100);
        expect(result.level).toMatch(/TRUSTED|ESTABLISHED|NEUTRAL|SUSPICIOUS/);
    });

    test("Risk level categorization logic", () => {
        expect(WalletReputationService.getRiskLevel(90)).toBe("TRUSTED");
        expect(WalletReputationService.getRiskLevel(70)).toBe("ESTABLISHED");
        expect(WalletReputationService.getRiskLevel(50)).toBe("NEUTRAL");
        expect(WalletReputationService.getRiskLevel(20)).toBe("SUSPICIOUS");
    });

    test("Handles missing address", async () => {
        const result = await WalletReputationService.calculateScore("");
        expect(result.score).toBe(0);
        expect(result.level).toBe("UNKNOWN");
    });
});
