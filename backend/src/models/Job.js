const mongoose = require("mongoose");

const JobSchema = new mongoose.Schema(
    {
        type: {
            type: String,
            required: true,
            trim: true,
        },
        status: {
            type: String,
            enum: ["pending", "processing", "completed", "failed"],
            default: "pending",
            index: true,
        },
        input: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
        result: {
            type: mongoose.Schema.Types.Mixed,
            default: null,
        },
        error: {
            type: String,
            default: null,
        },
    },
    {
        versionKey: false,
        timestamps: true,
    }
);

JobSchema.index({ status: 1, createdAt: 1 });

module.exports = mongoose.model("Job", JobSchema);
