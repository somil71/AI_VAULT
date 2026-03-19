const { z } = require("zod");

/**
 * Middleware factory for validating request data against a Zod schema.
 * Supports validating 'body', 'query', or 'params'.
 */
const validate = (schema, source = "body") => (req, res, next) => {
    try {
        const validatedData = schema.parse(req[source]);
        // Replace original data with validated/sanitized data
        req[source] = validatedData;
        next();
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({
                status: "error",
                error: "ValidationError",
                details: error.errors.map(e => ({
                     path: e.path.join("."),
                     message: e.message
                }))
            });
        }
        next(error);
    }
};

module.exports = { validate };
