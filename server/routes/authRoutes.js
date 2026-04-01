const express = require("express");
const jwt = require("jsonwebtoken");
const passport = require("passport");

const User = require("../models/User");
const Assessment = require("../models/Assessment");
const authMiddleware = require("../middleware/auth");
const { requireRole } = require("../middleware/roles");

const router = express.Router();

const forcedAdminEmails = new Set(
    [
        "academicanalyzer@gmail.com",
        ...String(process.env.GOOGLE_ADMIN_EMAILS || process.env.ADMIN1_EMAIL || "")
            .split(",")
            .map((item) => item.trim().toLowerCase())
            .filter(Boolean)
    ]
);

const isForcedAdminEmail = (email) => forcedAdminEmails.has(String(email || "").toLowerCase());

const enforceReservedRole = async (user) => {
    if (user && isForcedAdminEmail(user.email) && user.role !== "admin") {
        user.role = "admin";
        await user.save();
    }
    return user;
};

const issueToken = (user) => jwt.sign(
    { id: user._id.toString() },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
);

const toBaseUsername = (value) => String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9._-]/g, "")
    .replace(/^[._-]+|[._-]+$/g, "");

const uniqueUsername = async (seedValue) => {
    const base = toBaseUsername(seedValue) || "user";
    let candidate = base;
    let suffix = 1;
    // Keep probing until the username is free.
    while (await User.exists({ username: candidate })) {
        suffix += 1;
        candidate = `${base}${suffix}`;
    }
    return candidate;
};

const serializeUser = (user) => ({
    id: user._id,
    name: user.name,
    username: user.username,
    email: user.email,
    role: user.role,
    registerNumber: user.registerNumber || "",
    department: user.department || "",
    assignedSubjects: Array.isArray(user.assignedSubjects) ? user.assignedSubjects : [],
    semester: user.semester ?? null
});

const normalizeAssignedSubjects = (value) => {
    const items = Array.isArray(value)
        ? value
        : String(value || "")
            .split(",")
            .map((item) => item.trim());
    return [...new Set(items.filter(Boolean))];
};

router.post("/register", async (req, res) => {
    try {
        const {
            name,
            username,
            email,
            password,
            role,
            registerNumber,
            department,
            assignedSubjects,
            semester
        } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ message: "name, email, and password are required" });
        }

        const normalizedEmail = email.toLowerCase().trim();
        const roleValue = isForcedAdminEmail(normalizedEmail)
            ? "admin"
            : (["student", "faculty", "admin"].includes(role) ? role : "student");
        const requestedUsername = toBaseUsername(username || normalizedEmail.split("@")[0]);

        const [existingEmail, generatedUsername] = await Promise.all([
            User.findOne({ email: normalizedEmail }),
            uniqueUsername(requestedUsername)
        ]);

        if (existingEmail) {
            return res.status(409).json({ message: "User already exists" });
        }

        const user = await User.create({
            name,
            username: generatedUsername,
            email: normalizedEmail,
            password,
            role: roleValue,
            registerNumber: registerNumber ? String(registerNumber).trim() : undefined,
            department: department ? String(department).trim() : undefined,
            assignedSubjects: normalizeAssignedSubjects(assignedSubjects),
            semester: Number.isFinite(Number(semester)) ? Number(semester) : undefined
        });
        await enforceReservedRole(user);
        const token = issueToken(user);

        return res.status(201).json({
            token,
            user: serializeUser(user)
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

router.post("/login", async (req, res) => {
    try {
        const { identifier, email, username, password } = req.body;
        const loginId = String(identifier || email || username || "").toLowerCase().trim();

        if (!loginId || !password) {
            return res.status(400).json({ message: "identifier and password are required" });
        }

        const user = await User.findOne({
            $or: [
                { email: loginId },
                { username: loginId }
            ]
        });
        if (!user) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        await enforceReservedRole(user);
        const token = issueToken(user);
        return res.status(200).json({
            token,
            user: serializeUser(user)
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

router.get("/google", (req, res, next) => {
    const rawLoginHint = String(req.query.login_hint || "").trim().toLowerCase();
    const loginHint = rawLoginHint && rawLoginHint.includes("@") ? rawLoginHint : undefined;

    const authenticator = passport.authenticate("google", {
        scope: ["profile", "email"],
        session: false,
        prompt: "select_account",
        ...(loginHint ? { login_hint: loginHint } : {})
    });

    return authenticator(req, res, next);
});

router.get(
    "/google/callback",
    passport.authenticate("google", {
        session: false,
        failureRedirect: `${process.env.CLIENT_URL}/login?error=google`
    }),
    (req, res) => {
        const token = issueToken(req.user);
        const redirect = new URL("/oauth-success", process.env.CLIENT_URL);
        redirect.searchParams.set("token", token);
        res.redirect(redirect.toString());
    }
);

router.get("/profile", authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select("name username email role registerNumber department assignedSubjects semester");
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        return res.status(200).json(serializeUser(user));
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

router.get("/users", authMiddleware, requireRole("admin"), async (_req, res) => {
    try {
        const users = await User.find({})
            .select("name username email role provider createdAt registerNumber department assignedSubjects semester")
            .sort({ createdAt: 1 });
        return res.status(200).json(users);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

router.post("/users", authMiddleware, requireRole("admin"), async (req, res) => {
    try {
        const {
            name,
            username,
            email,
            password,
            role,
            registerNumber,
            department,
            assignedSubjects,
            semester
        } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ message: "name, email, and password are required" });
        }

        const normalizedEmail = email.toLowerCase().trim();
        const requestedUsername = toBaseUsername(username || normalizedEmail.split("@")[0]);
        const roleValue = ["student", "faculty", "admin"].includes(role) ? role : "student";

        const [existingEmail, generatedUsername] = await Promise.all([
            User.findOne({ email: normalizedEmail }),
            uniqueUsername(requestedUsername)
        ]);

        if (existingEmail) {
            return res.status(409).json({ message: "User already exists" });
        }

        const user = await User.create({
            name,
            username: generatedUsername,
            email: normalizedEmail,
            password,
            role: roleValue,
            registerNumber: registerNumber ? String(registerNumber).trim() : undefined,
            department: department ? String(department).trim() : undefined,
            assignedSubjects: normalizeAssignedSubjects(assignedSubjects),
            semester: Number.isFinite(Number(semester)) ? Number(semester) : undefined
        });

        return res.status(201).json(serializeUser(user));
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

router.put("/users/:id", authMiddleware, requireRole("admin"), async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const { name, email, registerNumber, department, assignedSubjects, semester, password } = req.body;

        if (name !== undefined) user.name = String(name).trim();
        if (email !== undefined) user.email = String(email).trim().toLowerCase();
        if (registerNumber !== undefined) user.registerNumber = String(registerNumber).trim();
        if (department !== undefined) user.department = String(department).trim();
        if (assignedSubjects !== undefined) user.assignedSubjects = normalizeAssignedSubjects(assignedSubjects);
        if (semester !== undefined) {
            user.semester = Number.isFinite(Number(semester)) ? Number(semester) : undefined;
        }
        if (password) {
            user.password = password;
        }

        await user.save();
        return res.status(200).json(serializeUser(user));
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

router.delete("/users/:id", authMiddleware, requireRole("admin"), async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        await Assessment.deleteMany({ user: user._id });
        await user.deleteOne();

        return res.status(200).json({ message: "User deleted" });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

module.exports = router;
