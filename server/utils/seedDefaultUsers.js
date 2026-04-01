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
        role: "faculty",
        department: "Science and Humanities",
        assignedSubjects: ["Mathematics", "Physics", "Chemistry"]
    },
    {
        name: "System Admin",
        username: process.env.ADMIN1_USERNAME || "academicanalyzer",
        email: process.env.ADMIN1_EMAIL || "academicanalyzer@gmail.com",
        password: process.env.ADMIN1_PASSWORD || "academic@123",
        role: "admin"
    }
];

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const SEMESTER_COURSES = {
    1: [
        { code: "MA1101", subject: "Engineering Mathematics I" },
        { code: "PH1101", subject: "Engineering Physics" },
        { code: "EE1101", subject: "Basic Electrical Engineering" },
        { code: "CS1101", subject: "Programming in C" },
        { code: "GE1101", subject: "Engineering Graphics" },
        { code: "HS1101", subject: "Communication Skills" }
    ],
    2: [
        { code: "MA1201", subject: "Engineering Mathematics II" },
        { code: "EC1201", subject: "Electronic Devices" },
        { code: "EE1201", subject: "Circuit Theory" },
        { code: "CS1201", subject: "Data Structures" },
        { code: "GE1201", subject: "Environmental Science" },
        { code: "ME1201", subject: "Workshop Practice" }
    ],
    3: [
        { code: "EE2301", subject: "Electrical Machines I" },
        { code: "EE2302", subject: "Network Analysis" },
        { code: "EC2301", subject: "Digital Electronics" },
        { code: "EC2302", subject: "Signals and Systems" },
        { code: "EE2303", subject: "Measurements and Instrumentation" },
        { code: "MA2301", subject: "Probability and Statistics" }
    ],
    4: [
        { code: "EE2401", subject: "Electrical Machines II" },
        { code: "EE2402", subject: "Control Systems" },
        { code: "EC2401", subject: "Microprocessors and Microcontrollers" },
        { code: "EE2403", subject: "Power Systems I" },
        { code: "EC2402", subject: "Linear Integrated Circuits" },
        { code: "EE2404", subject: "Electromagnetic Fields" }
    ],
    5: [
        { code: "EE3501", subject: "Power Electronics" },
        { code: "EE3502", subject: "Power Systems II" },
        { code: "EC3501", subject: "Digital Signal Processing" },
        { code: "EC3502", subject: "Embedded Systems" },
        { code: "EE3503", subject: "Renewable Energy Systems" },
        { code: "EE35E1", subject: "Professional Elective I" }
    ],
    6: [
        { code: "EC3601", subject: "VLSI Design" },
        { code: "EE3601", subject: "Electric Drives and Control" },
        { code: "EE3602", subject: "High Voltage Engineering" },
        { code: "EE3603", subject: "Industrial Automation" },
        { code: "EE3604", subject: "Internet of Things for Energy Systems" },
        { code: "EE36E2", subject: "Professional Elective II" }
    ]
};

const STUDENT_MARK_PROFILES = {
    1: {
        semesterBase: [66, 68, 70, 72, 75, 82],
        subjectBias: {
            "Control Systems": 9,
            "Power Electronics": 7,
            "Industrial Automation": 4,
            "Microprocessors and Microcontrollers": -6,
            "Linear Integrated Circuits": -3
        }
    },
    2: {
        semesterBase: [63, 65, 68, 70, 74, 78],
        subjectBias: {
            "Digital Signal Processing": 8,
            "Embedded Systems": 7,
            "VLSI Design": 6,
            "Power Systems I": -5,
            "Electric Drives and Control": -4
        }
    },
    3: {
        semesterBase: [60, 64, 67, 71, 73, 76],
        subjectBias: {
            "Measurements and Instrumentation": 9,
            "Internet of Things for Energy Systems": 8,
            "Engineering Mathematics II": 5,
            "Electrical Machines II": -7,
            "High Voltage Engineering": -5
        }
    },
    4: {
        semesterBase: [69, 71, 73, 74, 77, 80],
        subjectBias: {
            "Power Systems II": 8,
            "Renewable Energy Systems": 7,
            "Probability and Statistics": 5,
            "Digital Electronics": -6,
            "VLSI Design": -4
        }
    }
};

const buildAcademicAssessmentsForStudent = (student, index) => {
    const studentNo = (index % 4) + 1;
    const profile = STUDENT_MARK_PROFILES[studentNo] || STUDENT_MARK_PROFILES[1];
    const registerNumber = student.registerNumber || `2026${String(studentNo).padStart(2, "0")}`;

    return Object.entries(SEMESTER_COURSES).flatMap(([semesterValue, courses]) => {
        const semester = Number(semesterValue);
        const semesterBase = profile.semesterBase[semester - 1] || 68;

        return courses.map((course, courseIndex) => {
            const score = clamp(
                semesterBase +
                ((courseIndex * 4 + studentNo * 3 + semester) % 9) -
                4 +
                (profile.subjectBias[course.subject] || 0),
                45,
                97
            );
            const payload = {
                user: student._id,
                subject: course.subject,
                semester,
                examiner: "Faculty One",
                assessmentType: "exam",
                examDate: new Date(Date.UTC(2026, semester - 1, Math.min(28, 8 + courseIndex * 2))).toISOString(),
                totalMarks: 100,
                marksDistribution: [{ section: "Semester Record", marks: 100 }],
                questionComplexity: { easy: 30, medium: 45, hard: 25 },
                studentMarks: [{ score, studentId: registerNumber }],
                averageScore: score
            };

            return {
                filter: {
                    user: student._id,
                    subject: course.subject,
                    semester,
                    assessmentType: "exam"
                },
                payload: {
                    ...payload,
                    ...analyzeAssessment(payload)
                }
            };
        });
    });
};

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
                provider: "local",
                department: item.department,
                assignedSubjects: item.assignedSubjects || []
            });
        } else {
            user.name = item.name;
            user.username = username;
            user.email = email;
            user.role = item.role;
            user.provider = "local";
            user.providerId = undefined;
            user.password = item.password;
            user.registerNumber = item.role === "student"
                ? (user.registerNumber || `2026${String((usersByRole.student?.length || 0) + 1).padStart(2, "0")}`)
                : user.registerNumber;
            user.department = item.department || (item.role === "student" ? "EEE" : item.department);
            user.semester = item.role === "student" ? (user.semester || 6) : user.semester;
            user.assignedSubjects = item.assignedSubjects || [];
        }

        if (item.role === "student") {
            user.registerNumber = user.registerNumber || `2026${String((usersByRole.student?.length || 0) + 1).padStart(2, "0")}`;
            user.department = user.department || "EEE";
            user.semester = user.semester || 6;
        }

        await user.save();
        usersByRole[item.role] = usersByRole[item.role] || [];
        usersByRole[item.role].push(user);
    }

    const students = usersByRole.student || [];
    for (let index = 0; index < students.length; index += 1) {
        const student = students[index];
        const generatedAssessments = buildAcademicAssessmentsForStudent(student, index);
        for (const entry of generatedAssessments) {
            await Assessment.findOneAndUpdate(
                entry.filter,
                { $set: entry.payload },
                { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
            );
        }
    }
};

module.exports = { ensureDefaultUsers, DEFAULT_USERS };
