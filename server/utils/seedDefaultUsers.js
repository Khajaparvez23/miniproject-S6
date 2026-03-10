const User = require("../models/User");
const Assessment = require("../models/Assessment");
const { analyzeAssessment } = require("./analyzer");

const DEFAULT_USERS = [
    {
        name: "Student One",
        username: "student1",
        email: process.env.STUDENT1_EMAIL || "student1@example.edu",
        password: "Student@123",
        role: "student"
    },
    {
        name: "Student Two",
        username: "student2",
        email: process.env.STUDENT2_EMAIL || "student2@example.edu",
        password: "Student@123",
        role: "student"
    },
    {
        name: "Student Three",
        username: "student3",
        email: process.env.STUDENT3_EMAIL || "student3@example.edu",
        password: "Student@123",
        role: "student"
    },
    {
        name: "Student Four",
        username: "student4",
        email: process.env.STUDENT4_EMAIL || "student4@example.edu",
        password: "Student@123",
        role: "student"
    },
    {
        name: "Faculty One",
        username: "faculty1",
        email: process.env.FACULTY1_EMAIL || "faculty1@example.edu",
        password: "Faculty@123",
        role: "faculty"
    },
    {
        name: "System Admin",
        username: process.env.ADMIN1_USERNAME || "academicanalyzer",
        email: process.env.ADMIN1_EMAIL || "academicanalyzer@gmail.com",
        password: process.env.ADMIN1_PASSWORD || "academic@123",
        role: "admin"
    }
];

const SAMPLE_ASSESSMENTS = [
    {
        subject: "Mathematics",
        examiner: "Faculty One",
        assessmentType: "exam",
        examDate: "2026-01-10",
        totalMarks: 100,
        marksDistribution: [
            { section: "Section A", marks: 30 },
            { section: "Section B", marks: 30 },
            { section: "Section C", marks: 40 }
        ],
        questionComplexity: { easy: 25, medium: 50, hard: 25 },
        studentMarks: [{ score: 72, studentId: "ST-001" }]
    },
    {
        subject: "Physics",
        examiner: "Faculty One",
        assessmentType: "exam",
        examDate: "2026-01-14",
        totalMarks: 100,
        marksDistribution: [
            { section: "Section A", marks: 35 },
            { section: "Section B", marks: 25 },
            { section: "Section C", marks: 40 }
        ],
        questionComplexity: { easy: 20, medium: 45, hard: 35 },
        studentMarks: [{ score: 63, studentId: "ST-002" }]
    },
    {
        subject: "Chemistry",
        examiner: "Faculty One",
        assessmentType: "exam",
        examDate: "2026-01-18",
        totalMarks: 100,
        marksDistribution: [
            { section: "Section A", marks: 25 },
            { section: "Section B", marks: 35 },
            { section: "Section C", marks: 40 }
        ],
        questionComplexity: { easy: 30, medium: 45, hard: 25 },
        studentMarks: [{ score: 78, studentId: "ST-003" }]
    },
    {
        subject: "Computer Science",
        examiner: "Faculty One",
        assessmentType: "exam",
        examDate: "2026-01-22",
        totalMarks: 100,
        marksDistribution: [
            { section: "Section A", marks: 40 },
            { section: "Section B", marks: 20 },
            { section: "Section C", marks: 40 }
        ],
        questionComplexity: { easy: 15, medium: 55, hard: 30 },
        studentMarks: [{ score: 69, studentId: "ST-004" }]
    }
];

const ensureDefaultUsers = async () => {
    const usersByRole = {};

    for (const item of DEFAULT_USERS) {
        const email = item.email.toLowerCase();
        const username = item.username.toLowerCase();
        let user = await User.findOne({
            $or: [{ email }, { username }]
        });

        if (!user) {
            user = new User({
                name: item.name,
                username,
                email,
                password: item.password,
                role: item.role,
                provider: "local"
            });
        } else {
            user.name = item.name;
            user.username = username;
            user.email = email;
            user.role = item.role;
            user.provider = "local";
            user.providerId = undefined;
            user.password = item.password;
        }

        await user.save();
        usersByRole[item.role] = usersByRole[item.role] || [];
        usersByRole[item.role].push(user);
    }

    const students = usersByRole.student || [];
    for (let index = 0; index < students.length && index < SAMPLE_ASSESSMENTS.length; index += 1) {
        const student = students[index];
        const existingCount = await Assessment.countDocuments({ user: student._id });
        if (existingCount > 0) {
            continue;
        }

        const payload = SAMPLE_ASSESSMENTS[index];
        const analysis = analyzeAssessment(payload);
        await Assessment.create({
            ...payload,
            ...analysis,
            user: student._id
        });
    }
};

module.exports = { ensureDefaultUsers, DEFAULT_USERS };
