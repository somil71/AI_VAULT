const express = require("express");
const axios = require("axios");
const multer = require("multer");
const auth = require("../middleware/auth");
const AnomalyResult = require("../models/AnomalyResult");

const router = express.Router();
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// ── CSV Parsing ──────────────────────────────────────────────────────────────

function parseCsvLine(line) {
    const values = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
        const ch = line[i];
        if (ch === '"') {
            const next = line[i + 1];
            if (inQuotes && next === '"') { current += '"'; i += 1; }
            else { inQuotes = !inQuotes; }
            continue;
        }
        if (ch === "," && !inQuotes) { values.push(current.trim()); current = ""; continue; }
        current += ch;
    }
    values.push(current.trim());
    return values;
}

function parseTransactionsFromCsv(buffer) {
    const content = buffer.toString("utf8").trim();
    if (!content) throw new Error("CSV file is empty");

    const lines = content.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) throw new Error("CSV must contain header and at least one row");

    const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
    const required = ["date", "description", "amount", "merchant"];
    const missing = required.filter((key) => !headers.includes(key));
    if (missing.length > 0) throw new Error(`CSV missing columns: ${missing.join(", ")}`);

    const rows = [];
    for (let i = 1; i < lines.length; i += 1) {
        const values = parseCsvLine(lines[i]);
        const row = {};
        headers.forEach((header, idx) => { row[header] = values[idx] || ""; });

        const amount = Number(String(row.amount || "").replace(/[$,]/g, ""));
        if (Number.isNaN(amount)) throw new Error(`Invalid amount at CSV row ${i + 1}`);

        rows.push({
            date: String(row.date || ""),
            description: String(row.description || ""),
            amount,
            merchant: String(row.merchant || ""),
            category: String(row.category || "Unknown"),
        });
    }
    return rows;
}

// ── AI Integration ───────────────────────────────────────────────────────────

function formatAnalysis(data) {
    const results = Array.isArray(data?.results) ? data.results : [];
    return {
        anomaly_score: data?.anomaly_score ?? 0,
        risk_category: data?.risk_category || "LOW",
        trigger_factors: data?.trigger_factors || [],
        results,
        anomaly_scores: results.map((tx) => ({ index: tx.index, score: tx.anomaly_score })),
        flagged_transactions: results.filter((tx) => tx.is_anomaly),
        total_transactions: data?.total_transactions || results.length,
        flagged_count: data?.flagged_count || 0,
        overall_risk_score: data?.overall_risk_score || 0,
        summary: data?.summary || "Transaction analysis complete",
    };
}

async function callTransactionAi(transactions) {
    const aiResponse = await axios.post(
        `${AI_SERVICE_URL}/analyze-transactions`,
        { transactions },
        { timeout: 30000 }
    );

    const body = aiResponse.data;
    const isOk = body?.success === true || body?.status === "success";
    if (!isOk || !body?.data) throw new Error("Invalid response from AI service");

    return formatAnalysis(body.data);
}

// ── Persistence ──────────────────────────────────────────────────────────────

async function persistAnomalyResult(userId, transactions, analysisResult) {
    try {
        const inputHash = AnomalyResult.computeInputHash(transactions);

        // Sanitize flagged transactions (strip raw text, keep structure)
        const sanitizedFlagged = (analysisResult.flagged_transactions || []).map((tx) => ({
            index: tx.index,
            date: tx.date,
            amount: tx.amount,
            merchant: tx.merchant,
            anomaly_score: tx.anomaly_score,
            risk_level: tx.risk_level,
            reasons: tx.reasons,
        }));

        await AnomalyResult.create({
            userId,
            inputHash,
            anomalyScore: analysisResult.anomaly_score ?? 0,
            riskCategory: analysisResult.risk_category || "LOW",
            totalTransactions: analysisResult.total_transactions || 0,
            flaggedCount: analysisResult.flagged_count || 0,
            overallRiskScore: analysisResult.overall_risk_score || 0,
            triggerFactors: analysisResult.trigger_factors || [],
            flaggedTransactions: sanitizedFlagged,
            summary: analysisResult.summary || "",
        });
    } catch (err) {
        // Log but do NOT block the client response for persistence failures
        console.error("[AnomalyPersistence] Failed to store result:", err.message);
    }
}

// ── Routes ───────────────────────────────────────────────────────────────────

router.post("/analyze", auth, async (req, res) => {
    try {
        const { transactions } = req.body || {};
        if (!Array.isArray(transactions) || transactions.length < 3) {
            return res.status(400).json({ status: "error", error: "BadRequest", message: "Provide at least 3 transactions" });
        }

        const data = await callTransactionAi(transactions);

        // Persist to DB (non-blocking)
        persistAnomalyResult(req.userId, transactions, data);

        return res.json({ status: "success", data });
    } catch (error) {
        if (error.code === "ECONNREFUSED") {
            return res.status(503).json({ status: "error", error: "AIServiceUnavailable", message: "AI service unavailable" });
        }
        return res.status(500).json({ status: "error", error: "ProcessingError", message: error.message });
    }
});

router.post("/upload-csv", auth, upload.single("file"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ status: "error", error: "BadRequest", message: "No CSV file uploaded" });
        }

        const transactions = parseTransactionsFromCsv(req.file.buffer);
        if (transactions.length < 3) {
            return res.status(400).json({ status: "error", error: "BadRequest", message: "Need at least 3 transactions" });
        }

        const data = await callTransactionAi(transactions);

        // Persist to DB (non-blocking)
        persistAnomalyResult(req.userId, transactions, data);

        return res.json({ status: "success", data });
    } catch (error) {
        if (error.code === "ECONNREFUSED") {
            return res.status(503).json({ status: "error", error: "AIServiceUnavailable", message: "AI service unavailable" });
        }
        const status = error.message?.toLowerCase().includes("csv") || error.message?.toLowerCase().includes("invalid")
            ? 400
            : 500;
        return res.status(status).json({ status: "error", error: "ProcessingError", message: error.message });
    }
});

/**
 * GET /api/v1/transactions/history
 * Paginated, user-isolated anomaly analysis history.
 */
router.get("/history", auth, async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
        const skip = (page - 1) * limit;

        const filter = { userId: req.userId };

        const [results, total] = await Promise.all([
            AnomalyResult.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            AnomalyResult.countDocuments(filter),
        ]);

        return res.json({
            status: "success",
            data: {
                results,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                },
            },
        });
    } catch (error) {
        return res.status(500).json({ status: "error", error: "HistoryLoadError", message: error.message });
    }
});

module.exports = router;
