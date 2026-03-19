const rateLimit = require("express-rate-limit");

/**
 * Standard API rate limiter.
 * Limits each IP to 100 requests every 15 minutes.
 */
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per `window`
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: {
        status: "error",
        error: "TooManyRequests",
        message: "Too many requests from this IP, please try again after 15 minutes",
    },
});

/**
 * Strict limiter for sensitive endpoints (Auth, AI).
 * Limits each IP to 20 requests every 15 minutes.
 */
const strictLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        status: "error",
        error: "TooManyRequests",
        message: "High traffic detected. Please wait before retrying sensitive operations.",
    },
});

module.exports = {
    apiLimiter,
    strictLimiter,
};
