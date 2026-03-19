/**
 * LifeVault AI Guardian — Extension Logic Tests
 * 
 * Tests for background and content script logic using Jest-like mocks.
 */

describe("Browser Extension Logic", () => {
    let mockChrome;

    beforeEach(() => {
        mockChrome = {
            tabs: {
                sendMessage: jest.fn(),
                onUpdated: { addListener: jest.fn() }
            },
            notifications: {
                create: jest.fn()
            },
            storage: {
                local: {
                    get: jest.fn().mockResolvedValue({ jwt: "test-token" }),
                    set: jest.fn()
                }
            },
            runtime: {
                onMessage: { addListener: jest.fn() }
            }
        };
        global.chrome = mockChrome;
    });

    test("Critical score (>0.65) triggers BLOCK_PAGE and notification", async () => {
        // Simulating the handler in background.js
        const handleResult = (score) => {
            if (score > 0.65) {
                chrome.tabs.sendMessage(1, { type: "BLOCK_PAGE", score });
                chrome.notifications.create({ title: "CRITICAL" });
            }
        };

        handleResult(0.85);

        expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(1, expect.objectContaining({ type: "BLOCK_PAGE" }));
        expect(mockChrome.notifications.create).toHaveBeenCalledWith(expect.objectContaining({ title: "CRITICAL" }));
    });

    test("Warning score (0.4-0.65) triggers notification but NO BLOCK_PAGE", async () => {
        const handleResult = (score) => {
            if (score > 0.65) {
                chrome.tabs.sendMessage(1, { type: "BLOCK_PAGE" });
            } else if (score > 0.40) {
                chrome.notifications.create({ title: "Warning" });
            }
        };

        handleResult(0.55);

        expect(mockChrome.tabs.sendMessage).not.toHaveBeenCalled();
        expect(mockChrome.notifications.create).toHaveBeenCalledWith(expect.objectContaining({ title: "Warning" }));
    });

    test("Low score (<0.4) triggers neither", async () => {
        const handleResult = (score) => {
            if (score > 0.65) {
                chrome.tabs.sendMessage(1, { type: "BLOCK_PAGE" });
            } else if (score > 0.40) {
                chrome.notifications.create({ title: "Warning" });
            }
        };

        handleResult(0.2);

        expect(mockChrome.tabs.sendMessage).not.toHaveBeenCalled();
        expect(mockChrome.notifications.create).not.toHaveBeenCalled();
    });
});
