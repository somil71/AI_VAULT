const axios = require("axios");
const Job = require("../models/Job");

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";
const WORKER_INTERVAL_MS = Number(process.env.JOB_WORKER_INTERVAL_MS || 2000);

let workerTimer = null;
let workerBusy = false;
const queueMetrics = {
    totalProcessed: 0,
    totalFailed: 0,
    totalProcessingTimeMs: 0,
    lastProcessedAt: null,
};

async function enqueueJob(type, input = {}) {
    const job = await Job.create({
        type,
        status: "pending",
        input,
    });
    return job;
}

async function updateJobStatus(jobId, status, payload = {}) {
    const update = { status };
    if (Object.prototype.hasOwnProperty.call(payload, "result")) {
        update.result = payload.result;
    }
    if (Object.prototype.hasOwnProperty.call(payload, "error")) {
        update.error = payload.error;
    }
    return Job.findByIdAndUpdate(jobId, { $set: update }, { new: true });
}

async function getJobById(jobId) {
    return Job.findById(jobId).lean();
}

function normalizePhishingResult(result = {}) {
    return {
        fraud_probability: result.fraud_probability,
        explanation: result.explanation || [],
        risk_level: result.risk_level || "LOW",
        heuristic_score: result.heuristic_score,
        model_confidence: result.model_confidence,
        suspicious_patterns: result.suspicious_patterns || [],
        url_analysis: result.url_analysis || null,
        scam_category: result.scam_category || "general_phishing",
        similar_pattern: result.similar_pattern || "N/A",
        confidence_score: result.confidence_score || result.model_confidence || 0,
        recommended_action: result.recommended_action || "Proceed cautiously and verify source.",
    };
}

async function processPhishingAnalyzeJob(job) {
    const { text, url } = job.input || {};
    if (!text && !url) {
        throw new Error("Provide text or url to analyze");
    }

    const aiResponse = await axios.post(`${AI_SERVICE_URL}/analyze-phishing`, { text, url }, { timeout: 30000 });
    const aiData = aiResponse.data;
    if (!aiData?.success || !aiData?.data) {
        throw new Error("Invalid response from AI service");
    }

    return normalizePhishingResult(aiData.data);
}

async function processJob(job) {
    if (job.type === "phishing_analyze") {
        return processPhishingAnalyzeJob(job);
    }
    throw new Error(`Unsupported job type: ${job.type}`);
}

async function processNextJob() {
    if (workerBusy) return null;
    workerBusy = true;
    try {
        const job = await Job.findOneAndUpdate(
            { status: "pending" },
            { $set: { status: "processing", error: null } },
            { sort: { createdAt: 1 }, new: true }
        );
        if (!job) return null;

        const startedAtMs = Date.now();
        try {
            const result = await processJob(job);
            await updateJobStatus(job._id, "completed", { result, error: null });
        } catch (error) {
            const message = error?.response?.data?.error || error?.message || "Job processing failed";
            await updateJobStatus(job._id, "failed", { error: message });
            queueMetrics.totalFailed += 1;
            console.error(`[jobQueue] job ${job._id} failed:`, message);
        } finally {
            const elapsed = Date.now() - startedAtMs;
            queueMetrics.totalProcessed += 1;
            queueMetrics.totalProcessingTimeMs += elapsed;
            queueMetrics.lastProcessedAt = new Date().toISOString();
        }

        return job;
    } finally {
        workerBusy = false;
    }
}

async function getQueueHealth() {
    const [pending, processing, failed] = await Promise.all([
        Job.countDocuments({ status: "pending" }),
        Job.countDocuments({ status: "processing" }),
        Job.countDocuments({ status: "failed" }),
    ]);

    const avgProcessingTimeMs =
        queueMetrics.totalProcessed > 0
            ? Number((queueMetrics.totalProcessingTimeMs / queueMetrics.totalProcessed).toFixed(2))
            : 0;

    return {
        pending,
        processing,
        failed,
        totalProcessed: queueMetrics.totalProcessed,
        totalFailed: queueMetrics.totalFailed,
        avgProcessingTimeMs,
        lastProcessedAt: queueMetrics.lastProcessedAt,
    };
}

function startJobWorker() {
    if (workerTimer) return;
    workerTimer = setInterval(() => {
        processNextJob().catch((error) => {
            console.error("[jobQueue] worker tick failed:", error.message);
        });
    }, WORKER_INTERVAL_MS);
}

module.exports = {
    enqueueJob,
    processNextJob,
    updateJobStatus,
    getJobById,
    getQueueHealth,
    startJobWorker,
};
