const mongoose = require("mongoose");

const marksDistributionSchema = new mongoose.Schema(
    {
        section: {
            type: String,
            required: true,
            trim: true
        },
        marks: {
            type: Number,
            required: true,
            min: 0
        }
    },
    { _id: false }
);

const complexitySchema = new mongoose.Schema(
    {
        easy: { type: Number, default: 0, min: 0 },
        medium: { type: Number, default: 0, min: 0 },
        hard: { type: Number, default: 0, min: 0 }
    },
    { _id: false }
);

const studentMarkSchema = new mongoose.Schema(
    {
        score: {
            type: Number,
            required: true,
            min: 0
        },
        studentId: {
            type: String,
            trim: true
        }
    },
    { _id: false }
);

const assessmentSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        subject: {
            type: String,
            required: true,
            trim: true
        },
        semester: {
            type: Number,
            min: 1,
            max: 8
        },
        examiner: {
            type: String,
            required: true,
            trim: true
        },
        assessmentType: {
            type: String,
            enum: ["quiz", "assignment", "exam", "other"],
            default: "exam"
        },
        examDate: {
            type: Date,
            required: true
        },
        totalMarks: {
            type: Number,
            required: true,
            min: 1
        },
        marksDistribution: {
            type: [marksDistributionSchema],
            validate: {
                validator: (entries) => Array.isArray(entries) && entries.length > 0,
                message: "At least one marks distribution entry is required."
            }
        },
        questionComplexity: {
            type: complexitySchema,
            default: () => ({})
        },
        studentMarks: {
            type: [studentMarkSchema],
            default: []
        },
        difficultyLevel: {
            type: String,
            enum: ["Easy", "Medium", "Hard"]
        },
        difficultyScore: {
            type: Number,
            min: 0,
            max: 100
        },
        averageScore: {
            type: Number,
            min: 0
        },
        passRate: {
            type: Number,
            min: 0,
            max: 100
        },
        performanceGap: {
            type: Number,
            min: 0
        },
        balanceStatus: {
            type: String,
            enum: ["Balanced", "Imbalanced"]
        },
        insights: {
            type: [String],
            default: []
        },
        suggestions: {
            type: [String],
            default: []
        }
    },
    {
        timestamps: true
    }
);

assessmentSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model("Assessment", assessmentSchema);
