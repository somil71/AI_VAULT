/**
 * Backend seed script - creates demo users and sample phishing records.
 * Run with: node src/seed.js
 */

require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/User");
const PhishingResult = require("./models/PhishingResult");

async function seed() {
    await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/lifevault");
    console.log("Connected to MongoDB...");

    const hash = await bcrypt.hash("demo123", 12);
    await User.findOneAndUpdate(
        { email: "demo@lifevault.ai" },
        { email: "demo@lifevault.ai", password: hash, role: "user" },
        { upsert: true }
    );
    await User.findOneAndUpdate(
        { email: "admin@lifevault.ai" },
        { email: "admin@lifevault.ai", password: hash, role: "admin" },
        { upsert: true }
    );
    console.log("Demo user: demo@lifevault.ai / demo123");
    console.log("Admin user: admin@lifevault.ai / demo123");

    await PhishingResult.create([
        {
            inputText: "URGENT: Your account will be suspended!",
            fraudProbability: 88.5,
            riskLevel: "CRITICAL",
            explanation: ["Classic phishing pattern detected", "Urgency manipulation found"],
            suspiciousPatterns: ["Urgency manipulation: 'urgent'"],
        },
        {
            inputUrl: "http://paypa1-secure.com/verify",
            fraudProbability: 76.0,
            riskLevel: "HIGH",
            explanation: ["Suspicious URL pattern"],
            suspiciousPatterns: ["Domain mimics 'paypal' brand"],
        },
    ]);
    console.log("Sample phishing records created");

    await mongoose.disconnect();
    console.log("Seed complete");
}

seed().catch(console.error);
