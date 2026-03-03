/**
 * Pre-deployment migration script for eVault AI.
 *
 * Purpose:
 *   1. Detect and remove duplicate email addresses
 *   2. Detect and remove duplicate wallet addresses
 *   3. Create unique indexes on User collection
 *   4. Create performance indexes on ActivityEvent and PhishingResult
 *
 * Usage:
 *   node scripts/migrate_unique_constraints.js
 *
 * Requirements:
 *   - MONGO_URI must be set in .env or environment
 *   - Run BEFORE deploying the new User.js schema
 */

const mongoose = require("mongoose");
require("dotenv").config();

async function run() {
    const uri = process.env.MONGO_URI;
    if (!uri) {
        console.error("FATAL: MONGO_URI is not set.");
        process.exit(1);
    }

    await mongoose.connect(uri);
    console.log("[migrate] Connected to MongoDB");

    const db = mongoose.connection.db;
    const users = db.collection("users");
    const phishing = db.collection("phishingresults");
    const activity = db.collection("activityevents");

    // ── Step 1: Deduplicate emails ──────────────────────────────────────────
    console.log("\n[Step 1] Checking for duplicate emails...");
    const emailDups = await users
        .aggregate([
            { $group: { _id: { $toLower: "$email" }, count: { $sum: 1 }, ids: { $push: "$_id" } } },
            { $match: { count: { $gt: 1 } } },
        ])
        .toArray();

    if (emailDups.length === 0) {
        console.log("  No duplicate emails found. ✅");
    } else {
        for (const dup of emailDups) {
            const keepId = dup.ids[0];
            const removeIds = dup.ids.slice(1);
            console.log("  Email '%s': keeping %s, removing %d duplicates", dup._id, keepId, removeIds.length);
            await users.deleteMany({ _id: { $in: removeIds } });
        }
        console.log("  Cleaned %d duplicate email groups. ✅", emailDups.length);
    }

    // ── Step 2: Deduplicate wallet addresses ────────────────────────────────
    console.log("\n[Step 2] Checking for duplicate wallet addresses...");
    const walletDups = await users
        .aggregate([
            { $match: { walletAddress: { $ne: null, $exists: true } } },
            { $group: { _id: { $toLower: "$walletAddress" }, count: { $sum: 1 }, ids: { $push: "$_id" } } },
            { $match: { count: { $gt: 1 } } },
        ])
        .toArray();

    if (walletDups.length === 0) {
        console.log("  No duplicate wallet addresses found. ✅");
    } else {
        for (const dup of walletDups) {
            const keepId = dup.ids[0];
            const removeIds = dup.ids.slice(1);
            console.log("  Wallet '%s': keeping %s, removing %d duplicates", dup._id, keepId, removeIds.length);
            await users.deleteMany({ _id: { $in: removeIds } });
        }
        console.log("  Cleaned %d duplicate wallet groups. ✅", walletDups.length);
    }

    // ── Step 3: Create unique indexes on users ──────────────────────────────
    console.log("\n[Step 3] Creating indexes on 'users' collection...");
    try {
        await users.createIndex({ email: 1 }, { unique: true, name: "email_unique" });
        console.log("  email_unique index created. ✅");
    } catch (err) {
        console.error("  Failed to create email index:", err.message);
    }

    try {
        await users.createIndex({ walletAddress: 1 }, { unique: true, sparse: true, name: "wallet_unique_sparse" });
        console.log("  wallet_unique_sparse index created. ✅");
    } catch (err) {
        console.error("  Failed to create wallet index:", err.message);
    }

    try {
        await users.createIndex({ email: 1, walletAddress: 1 }, { name: "email_wallet_compound" });
        console.log("  email_wallet_compound index created. ✅");
    } catch (err) {
        console.error("  Failed to create compound index:", err.message);
    }

    // ── Step 4: Performance indexes on PhishingResult ───────────────────────
    console.log("\n[Step 4] Creating indexes on 'phishingresults'...");
    try {
        await phishing.createIndex({ risk_score: 1 }, { name: "risk_score_idx" });
        await phishing.createIndex({ userId: 1, analyzedAt: -1 }, { name: "user_analyzed_idx" });
        console.log("  PhishingResult indexes created. ✅");
    } catch (err) {
        console.error("  Failed:", err.message);
    }

    // ── Step 5: Performance indexes on ActivityEvent ────────────────────────
    console.log("\n[Step 5] Creating indexes on 'activityevents'...");
    try {
        await activity.createIndex({ type: 1, createdAt: -1 }, { name: "type_created_idx" });
        await activity.createIndex({ userEmail: 1, createdAt: -1 }, { name: "email_created_idx" });
        console.log("  ActivityEvent indexes created. ✅");
    } catch (err) {
        console.error("  Failed:", err.message);
    }

    // ── Done ────────────────────────────────────────────────────────────────
    console.log("\n[migrate] ✅ Migration complete. Safe to deploy new schema.");
    process.exit(0);
}

run().catch((err) => {
    console.error("[migrate] FATAL:", err);
    process.exit(1);
});
