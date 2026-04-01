const jwt = require("jsonwebtoken");
const User = require("../models/User");

const authMiddleware = async (req, res, next) => {
    const authHeader = req.headers.authorization || "";
    const [scheme, token] = authHeader.split(" ");

    if (scheme !== "Bearer" || !token) {
        return res.status(401).json({ message: "Authentication required" });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select("name username email role registerNumber department assignedSubjects semester");
        if (!user) {
            return res.status(401).json({ message: "User no longer exists" });
        }
        req.user = {
            id: user._id.toString(),
            name: user.name,
            username: user.username,
            email: user.email,
            role: user.role,
            registerNumber: user.registerNumber || "",
            department: user.department || "",
            assignedSubjects: Array.isArray(user.assignedSubjects) ? user.assignedSubjects : [],
            semester: user.semester ?? null
        };
        return next();
    } catch (_error) {
        return res.status(401).json({ message: "Invalid or expired token" });
    }
};

module.exports = authMiddleware;
