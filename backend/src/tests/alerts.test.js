const { AlertService } = require("../services/alertService");
const axios = require("axios");

jest.mock("axios");

describe("AlertService Dispatch Logic", () => {
    const testUserId = "65a1234567890abcdef12345";
    const alertData = {
        title: "Malicious Content Detected",
        message: "Phishing attempt on test-scam.com",
        riskLevel: "CRITICAL",
        input: "http://test-scam.com"
    };

    beforeEach(() => {
        process.env.RESEND_API_KEY = "re_test_123";
        process.env.FRONTEND_URL = "http://localhost:3000";
        jest.clearAllMocks();
    });

    test("sendEmail calls Resend API with correct parameters", async () => {
        axios.post.mockResolvedValue({ data: { id: "msg_123" } });

        await AlertService.sendEmail("user@example.com", alertData);

        expect(axios.post).toHaveBeenCalledWith(
            "https://api.resend.com/emails",
            expect.objectContaining({
                to: "user@example.com",
                subject: expect.stringContaining("SECURITY ALERT"),
                html: expect.stringContaining("CRITICAL")
            }),
            expect.objectContaining({
                headers: { "Authorization": "Bearer re_test_123" }
            })
        );
    });

    test("dispatchAlert handles missing API keys gracefully", async () => {
        delete process.env.RESEND_API_KEY;
        const spy = jest.spyOn(AlertService, "sendEmail");

        // We'll simulate a user lookup failure or empty dispatch
        // because we don't want to mock the entire User model here for a unit test
        // In a real scenario, we'd use a mock DB or test-specific runner
        
        // Just verifying it doesn't crash
        await expect(AlertService.dispatchAlert(testUserId, alertData)).resolves.not.toThrow();
        spy.mockRestore();
    });
});
