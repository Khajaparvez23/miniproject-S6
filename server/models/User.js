const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },
        username: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },
        registerNumber: {
            type: String,
            trim: true
        },
        department: {
            type: String,
            trim: true
        },
        assignedSubjects: {
            type: [String],
            default: []
        },
        semester: {
            type: Number,
            min: 1,
            max: 12
        },
        password: {
            type: String,
            minlength: 6
        },
        role: {
            type: String,
            enum: ["student", "faculty", "admin"],
            default: "student"
        },
        provider: {
            type: String,
            enum: ["local", "google", "github"],
            default: "local"
        },
        providerId: {
            type: String,
            trim: true
        },
        preferences: {
            comparison: {
                assessmentA: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Assessment"
                },
                assessmentB: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Assessment"
                }
            },
            passThresholdPercent: {
                type: Number,
                min: 1,
                max: 100,
                default: 45
            }
        }
    },
    { timestamps: true }
);

userSchema.pre("save", async function hashPassword() {
    if (!this.isModified("password")) {
        return;
    }
    if (!this.password) {
        return;
    }

    this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.comparePassword = function comparePassword(candidatePassword) {
    if (!this.password) {
        return false;
    }
    return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
