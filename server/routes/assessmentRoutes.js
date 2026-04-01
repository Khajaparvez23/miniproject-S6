const express = require("express");
const mongoose = require("mongoose");

const Assessment = require("../models/Assessment");
const User = require("../models/User");
const authMiddleware = require("../middleware/auth");
const { requireRole } = require("../middleware/roles");
const { analyzeAssessment } = require("../utils/analyzer");

const router = express.Router();

router.use(authMiddleware);

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const buildScopeFilter = (req) => {
    if (req.user.role === "admin") {
        const requestedUserId = req.query.userId;
        if (requestedUserId && isValidObjectId(requestedUserId)) {
            return { user: new mongoose.Types.ObjectId(requestedUserId) };
        }
        return {};
    }
    return { user: new mongoose.Types.ObjectId(req.user.id) };
};

const appendQueryFilters = (filters, query) => {
    const next = { ...filters };
    const { subject, difficultyLevel, fromDate, toDate } = query;

    if (subject) {
        next.subject = { $regex: subject, $options: "i" };
    }
    if (difficultyLevel) {
        next.difficultyLevel = difficultyLevel;
    }
    if (fromDate || toDate) {
        next.examDate = {};
        if (fromDate) {
            next.examDate.$gte = new Date(fromDate);
        }
        if (toDate) {
            next.examDate.$lte = new Date(toDate);
        }
    }

    return next;
};

router.post("/", requireRole("admin"), async (req, res) => {
    try {
        const payload = { ...req.body };
        const targetUser = payload.user && isValidObjectId(payload.user) ? payload.user : req.user.id;
        const analysis = analyzeAssessment(payload);

        const assessment = await Assessment.create({
            ...payload,
            user: targetUser,
            ...analysis
        });

        return res.status(201).json(assessment);
    } catch (error) {
        return res.status(400).json({ message: error.message });
    }
});

router.put("/:id", requireRole("admin"), async (req, res) => {
    try {
        if (!isValidObjectId(req.params.id)) {
            return res.status(400).json({ message: "Invalid assessment id" });
        }
        const payload = { ...req.body };
        const analysis = analyzeAssessment(payload);
        const updatePayload = { ...payload, ...analysis };
        if (payload.user && !isValidObjectId(payload.user)) {
            return res.status(400).json({ message: "Invalid user id for assessment owner" });
        }

        const updated = await Assessment.findByIdAndUpdate(
            req.params.id,
            { $set: updatePayload },
            { new: true, runValidators: true }
        );
        if (!updated) {
            return res.status(404).json({ message: "Assessment not found" });
        }
        return res.status(200).json(updated);
    } catch (error) {
        return res.status(400).json({ message: error.message });
    }
});

router.delete("/:id", requireRole("admin"), async (req, res) => {
    try {
        if (!isValidObjectId(req.params.id)) {
            return res.status(400).json({ message: "Invalid assessment id" });
        }
        const deleted = await Assessment.findByIdAndDelete(req.params.id);
        if (!deleted) {
            return res.status(404).json({ message: "Assessment not found" });
        }
        return res.status(200).json({ message: "Assessment deleted" });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

router.get("/", async (req, res) => {
    try {
        const scopeFilter = buildScopeFilter(req);
        const filters = appendQueryFilters(scopeFilter, req.query);

        const query = Assessment.find(filters).sort({ createdAt: -1 });
        if (req.user.role === "admin") {
            query.populate("user", "name username email role");
        }
        const assessments = await query;
        return res.status(200).json(assessments);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

router.get("/faculty/student-results", requireRole("faculty", "admin"), async (req, res) => {
    try {
        const managedStudents = await User.find({ role: "student" })
            .select("name username email registerNumber department semester")
            .sort({ createdAt: 1 });

        if (!managedStudents.length) {
            return res.status(200).json([]);
        }

        const studentIds = managedStudents.map((item) => item._id);
        const assessments = await Assessment.find({
            user: { $in: studentIds },
            $or: [
                { assessmentType: "exam" },
                { assessmentType: { $exists: false } },
                { assessmentType: null }
            ]
        })
            .sort({ examDate: -1, createdAt: -1 })
            .select("_id user subject examDate totalMarks difficultyLevel difficultyScore passRate averageScore");

        const byStudent = new Map();
        for (const record of assessments) {
            const key = record.user.toString();
            if (!byStudent.has(key)) {
                byStudent.set(key, []);
            }
            byStudent.get(key).push(record);
        }

        const result = managedStudents.map((student) => {
            const rows = byStudent.get(student._id.toString()) || [];
            return {
                student: {
                    id: student._id,
                    name: student.name,
                    username: student.username,
                    email: student.email,
                    registerNumber: student.registerNumber,
                    department: student.department,
                    semester: student.semester
                },
                assessments: rows
            };
        });

        return res.status(200).json(result);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

router.get("/reports/class-performance", async (req, res) => {
    try {
        const students = await User.find({ role: "student" })
            .select("_id")
            .sort({ createdAt: 1 });

        if (!students.length) {
            return res.status(200).json({
                totalStudents: 0,
                classAverage: 0,
                passPercentage: 0,
                topScore: 0,
                failedStudents: 0
            });
        }

        const studentIds = students.map((student) => student._id);
        const assessments = await Assessment.find({
            user: { $in: studentIds },
            $or: [
                { assessmentType: "exam" },
                { assessmentType: { $exists: false } },
                { assessmentType: null }
            ]
        })
            .sort({ examDate: -1, createdAt: -1 })
            .select("user totalMarks averageScore studentMarks");

        const examScores = assessments.flatMap((assessment) => {
            const studentEntries = Array.isArray(assessment.studentMarks)
                ? assessment.studentMarks
                : [];

            if (studentEntries.length) {
                return studentEntries
                    .map((entry) => {
                        const score = Number(entry?.score);
                        if (!Number.isFinite(score) || score < 0) {
                            return null;
                        }

                        return {
                            studentKey: entry?.studentId || assessment.user.toString(),
                            score,
                            totalMarks: Math.max(1, Number(assessment.totalMarks) || 100)
                        };
                    })
                    .filter(Boolean);
            }

            const score = Number(assessment.averageScore);
            if (!Number.isFinite(score) || score < 0) {
                return [];
            }

            const totalMarks = Math.max(1, Number(assessment.totalMarks) || 100);

            return [{
                studentKey: assessment.user.toString(),
                score,
                totalMarks
            }];
        });

        if (!examScores.length) {
            return res.status(200).json({
                totalStudents: 0,
                classAverage: 0,
                passPercentage: 0,
                topScore: 0,
                failedStudents: 0
            });
        }

        const PASS_PERCENT = 45;
        const uniqueStudents = new Set(examScores.map((entry) => entry.studentKey));
        const failedStudents = new Set();
        const totalScore = examScores.reduce((sum, entry) => {
            const threshold = entry.totalMarks * (PASS_PERCENT / 100);
            if (entry.score < threshold) {
                failedStudents.add(entry.studentKey);
            }
            return sum + entry.score;
        }, 0);
        const passedRecords = examScores.filter(
            (entry) => entry.score >= entry.totalMarks * (PASS_PERCENT / 100)
        ).length;

        return res.status(200).json({
            totalStudents: uniqueStudents.size,
            classAverage: totalScore / examScores.length,
            passPercentage: (passedRecords / examScores.length) * 100,
            topScore: examScores.reduce((highest, entry) => Math.max(highest, entry.score), 0),
            failedStudents: failedStudents.size
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

router.get("/reports/summary", async (req, res) => {
    try {
        const filters = buildScopeFilter(req);

        const [summary, difficultySplit, recent] = await Promise.all([
            Assessment.aggregate([
                { $match: filters },
                {
                    $group: {
                        _id: null,
                        totalAssessments: { $sum: 1 },
                        avgDifficultyScore: { $avg: "$difficultyScore" },
                        imbalancedAssessments: {
                            $sum: {
                                $cond: [{ $eq: ["$balanceStatus", "Imbalanced"] }, 1, 0]
                            }
                        }
                    }
                }
            ]),
            Assessment.aggregate([
                { $match: filters },
                { $group: { _id: "$difficultyLevel", count: { $sum: 1 } } }
            ]),
            Assessment.find(filters)
                .select("subject examDate difficultyLevel balanceStatus")
                .sort({ createdAt: -1 })
                .limit(5)
        ]);

        return res.status(200).json({
            overview: summary[0] || {
                totalAssessments: 0,
                avgDifficultyScore: 0,
                imbalancedAssessments: 0
            },
            difficultySplit,
            recent
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

router.get("/reports/advanced", async (req, res) => {
    try {
        const filters = buildScopeFilter(req);

        const [bySubject, balanceSplit, marksStats] = await Promise.all([
            Assessment.aggregate([
                { $match: filters },
                {
                    $group: {
                        _id: "$subject",
                        total: { $sum: 1 },
                        avgDifficulty: { $avg: "$difficultyScore" },
                        avgMarks: { $avg: "$totalMarks" }
                    }
                },
                { $sort: { total: -1 } },
                { $limit: 6 }
            ]),
            Assessment.aggregate([
                { $match: filters },
                { $group: { _id: "$balanceStatus", count: { $sum: 1 } } }
            ]),
            Assessment.aggregate([
                { $match: filters },
                {
                    $group: {
                        _id: null,
                        minMarks: { $min: "$totalMarks" },
                        maxMarks: { $max: "$totalMarks" },
                        avgMarks: { $avg: "$totalMarks" }
                    }
                }
            ])
        ]);

        return res.status(200).json({
            bySubject,
            balanceSplit,
            marksStats: marksStats[0] || { minMarks: 0, maxMarks: 0, avgMarks: 0 }
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

router.get("/:id", async (req, res) => {
    try {
        if (!isValidObjectId(req.params.id)) {
            return res.status(400).json({ message: "Invalid assessment id" });
        }
        const filter = { _id: req.params.id };
        if (req.user.role !== "admin") {
            filter.user = req.user.id;
        }
        const assessment = await Assessment.findOne(filter);

        if (!assessment) {
            return res.status(404).json({ message: "Assessment not found" });
        }

        return res.status(200).json(assessment);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

module.exports = router;
