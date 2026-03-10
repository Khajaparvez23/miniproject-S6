const express = require("express");
const mongoose = require("mongoose");

const User = require("../models/User");
const Assessment = require("../models/Assessment");
const authMiddleware = require("../middleware/auth");
const { requireRole } = require("../middleware/roles");

const router = express.Router();

router.use(authMiddleware);

const sanitizeId = (value) => (mongoose.Types.ObjectId.isValid(value) ? value : null);
const sanitizePassThreshold = (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return null;
    if (parsed < 1 || parsed > 100) return null;
    return parsed;
};

router.get("/", async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select("preferences");
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        return res.status(200).json({
            comparison: {
                assessmentA: user.preferences?.comparison?.assessmentA || null,
                assessmentB: user.preferences?.comparison?.assessmentB || null
            },
            passThresholdPercent: user.preferences?.passThresholdPercent ?? 45
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

router.put("/", requireRole("admin"), async (req, res) => {
    try {
        const comparison = req.body?.comparison || {};
        const assessmentA = sanitizeId(comparison.assessmentA);
        const assessmentB = sanitizeId(comparison.assessmentB);
        const hasPassThreshold = req.body?.passThresholdPercent !== undefined;
        const passThresholdPercent = hasPassThreshold
            ? sanitizePassThreshold(req.body.passThresholdPercent)
            : null;

        if (hasPassThreshold && passThresholdPercent === null) {
            return res.status(400).json({ message: "Pass threshold must be a number between 1 and 100" });
        }

        const ids = [assessmentA, assessmentB].filter(Boolean);
        if (ids.length) {
            const validCount = await Assessment.countDocuments({
                _id: { $in: ids },
                user: req.user.id
            });
            if (validCount !== ids.length) {
                return res.status(400).json({ message: "Invalid assessment selection" });
            }
        }

        const setPayload = {
            "preferences.comparison.assessmentA": assessmentA,
            "preferences.comparison.assessmentB": assessmentB
        };
        if (passThresholdPercent !== null) {
            setPayload["preferences.passThresholdPercent"] = passThresholdPercent;
        }

        const user = await User.findByIdAndUpdate(
            req.user.id,
            {
                $set: setPayload
            },
            { new: true }
        ).select("preferences");

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        return res.status(200).json({
            comparison: {
                assessmentA: user.preferences?.comparison?.assessmentA || null,
                assessmentB: user.preferences?.comparison?.assessmentB || null
            },
            passThresholdPercent: user.preferences?.passThresholdPercent ?? 45
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

module.exports = router;
