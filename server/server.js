require("dns").setDefaultResultOrder("ipv4first");
require("dotenv").config();

const compression = require("compression");
const cors = require("cors");
const express = require("express");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const passport = require("passport");

const connectDB = require("./config/db");
const configurePassport = require("./config/passport");
const authRoutes = require("./routes/authRoutes");
const assessmentRoutes = require("./routes/assessmentRoutes");
const preferencesRoutes = require("./routes/preferencesRoutes");
const logger = require("./utils/logger");
const { ensureDefaultUsers } = require("./utils/seedDefaultUsers");

const app = express();
const port = process.env.PORT || 5000;
const enableHttpLogs = process.env.DISABLE_HTTP_LOGS !== "1";

if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is required in server/.env");
    process.exit(1);
}

if (!process.env.JWT_SECRET) {
    console.error("JWT_SECRET is required in server/.env");
    process.exit(1);
}

configurePassport();

app.set("trust proxy", 1);
app.use(helmet());
app.use(compression());
const corsOptions = process.env.CLIENT_URL
    ? { origin: process.env.CLIENT_URL, credentials: true }
    : { origin: "*" };
app.use(cors(corsOptions));
app.use(express.json());
app.use(passport.initialize());
if (enableHttpLogs) {
    app.use(morgan("combined", { stream: { write: (msg) => logger.info(msg.trim()) } }));
}

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    skip: (req) => ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.ip),
    standardHeaders: true,
    legacyHeaders: false
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    skip: (req) => ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.ip),
    standardHeaders: true,
    legacyHeaders: false
});

app.get("/", (_req, res) => {
    res.json({ message: "Academic Assessment Quality Analyzer API is running" });
});
app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api", apiLimiter);
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/auth", authRoutes);
app.use("/api/assessments", assessmentRoutes);
app.use("/api/preferences", preferencesRoutes);

app.use((req, res) => {
    res.status(404).json({ message: "Not found" });
});

app.use((err, _req, res, _next) => {
    logger.error(err);
    res.status(500).json({ message: "Internal server error" });
});

const startServer = async () => {
    await connectDB();
    await ensureDefaultUsers();

    app.listen(port, () => {
        console.log(`Server started on port ${port}`);
    });
};

startServer().catch((error) => {
    console.error("Server startup failed:", error.message);
    process.exit(1);
});
