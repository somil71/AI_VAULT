/**
 * Manual Sanitization Middleware
 * Protects against:
 * 1. NoSQL Injection (recursive key/value check for '$' and '.')
 * 2. XSS (basic HTML tag removal/encoding)
 */

function sanitizeValue(value) {
    if (typeof value === "string") {
        // Basic XSS prevention: remove common tags
        return value
            .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "")
            .replace(/<+[^>]+>+/gim, "")
            .trim();
    }
    if (Array.isArray(value)) {
        return value.map(sanitizeValue);
    }
    if (value !== null && typeof value === "object") {
        const sanitized = {};
        for (const key in value) {
            // NoSQL key injection prevention: reject or sanitize keys starting with $ or containing .
            const cleanKey = key.replace(/^\$/, "").replace(/\./g, "_");
            sanitized[cleanKey] = sanitizeValue(value[key]);
        }
        return sanitized;
    }
    return value;
}

const sanitize = (req, res, next) => {
    if (req.body) req.body = sanitizeValue(req.body);
    if (req.query) req.query = sanitizeValue(req.query);
    if (req.params) req.params = sanitizeValue(req.params);
    next();
};

module.exports = { sanitize };
