const crypto = require("crypto");
const { User } = require("../models/User");

/**
 * Referral Service
 * Manages unique referral codes and credit-based growth loops.
 */
class ReferralService {
    
    /**
     * Generates a unique, readable referral code for a user.
     */
    static async generateCode(userId) {
        let code;
        let exists = true;
        
        while (exists) {
            code = crypto.randomBytes(4).toString("hex").toUpperCase();
            exists = await User.exists({ referralCode: code });
        }

        await User.findByIdAndUpdate(userId, { referralCode: code });
        return code;
    }

    /**
     * Processes a referral on user registration.
     */
    static async processReferral(newUserId, code) {
        const referrer = await User.findOne({ referralCode: code });
        if (!referrer) return false;

        await User.findByIdAndUpdate(newUserId, { referredBy: referrer._id });
        
        // Log event for reward processing (e.g. 1 month free Pro if 5 referrals)
        console.log(`[REFERRAL] User ${newUserId} referred by ${referrer._id}`);
        return true;
    }

    /**
     * Gets referral stats for a user (how many people they've referred).
     */
    static async getStats(userId) {
        const count = await User.countDocuments({ referredBy: userId });
        const user = await User.findById(userId).select("referralCode");
        
        return {
            referralCode: user.referralCode,
            totalReferrals: count,
            rewardProgress: `${Math.min(count, 5)}/5 to next reward`,
            link: `${process.env.FRONTEND_URL}/register?ref=${user.referralCode}`
        };
    }
}

module.exports = { ReferralService };
