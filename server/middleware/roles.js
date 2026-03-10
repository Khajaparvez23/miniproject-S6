const requireRole = (...roles) => (req, res, next) => {
    if (!req.user?.role || !roles.includes(req.user.role)) {
        return res.status(403).json({ message: "Forbidden: insufficient role permissions" });
    }
    return next();
};

module.exports = { requireRole };
