const { ReferralService } = require("../services/referralService");
const mongoose = require("mongoose");
const { User } = require("../models/User");

describe("ReferralService Logic", () => {
    let testUser;

    beforeAll(async () => {
        // Mocking user for unit test if needed, or assume DB connectivity in integration context
    });

    test("generateCode returns short unique string", async () => {
        // Mocking User.exists to always return false (new code)
        jest.spyOn(User, "exists").mockResolvedValue(false);
        jest.spyOn(User, "findByIdAndUpdate").mockResolvedValue({});
        
        const code = await ReferralService.generateCode("65a1234567890abcdef12345");
        expect(code).toHaveLength(8);
        expect(typeof code).toBe("string");
        
        User.exists.mockRestore();
        User.findByIdAndUpdate.mockRestore();
    });

    test("processReferral links users correctly", async () => {
        const referrerId = new mongoose.Types.ObjectId();
        const newUserId = new mongoose.Types.ObjectId();
        const refCode = "TEST1234";

        jest.spyOn(User, "findOne").mockResolvedValue({ _id: referrerId });
        jest.spyOn(User, "findByIdAndUpdate").mockResolvedValue({});

        const success = await ReferralService.processReferral(newUserId, refCode);
        
        expect(success).toBe(true);
        expect(User.findOne).toHaveBeenCalledWith({ referralCode: refCode });
        expect(User.findByIdAndUpdate).toHaveBeenCalledWith(newUserId, { referredBy: referrerId });

        User.findOne.mockRestore();
        User.findByIdAndUpdate.mockRestore();
    });
});
