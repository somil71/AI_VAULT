/**
 * Production response wrapper for the eVault backend.
 * Enforces: { status, data, meta: { request_id, latency_ms, timestamp } }
 */
function responseWrapper(req, res, next) {
    const originalJson = res.json;

    res.json = (body) => {
        // If it's already structured, or an direct error from a 4xx/5xx manual catch
        if (body?.status && (body?.data || body?.error)) {
            // Already structured, just attach meta if missing
            if (!body.meta) {
                const latency = Number(process.hrtime.bigint() - (req.startTimeNs || 0n)) / 1_000_000;
                body.meta = {
                    request_id: req.requestId,
                    latency_ms: Number(latency.toFixed(2)),
                    timestamp: new Date().toISOString()
                };
            }
            return originalJson.call(res, body);
        }

        // Standard data wrap
        const latency = Number(process.hrtime.bigint() - (req.startTimeNs || 0n)) / 1_000_000;
        const wrapped = {
            status: res.statusCode >= 400 ? "error" : "success",
            data: res.statusCode < 400 ? body : undefined,
            error: res.statusCode >= 400 ? (body.error || body.name || "Error") : undefined,
            message: res.statusCode >= 400 ? (body.message || "Unknown error") : undefined,
            meta: {
                request_id: req.requestId,
                latency_ms: Number(latency.toFixed(2)),
                timestamp: new Date().toISOString()
            }
        };

        return originalJson.call(res, wrapped);
    };

    next();
}

module.exports = responseWrapper;
