const mongoose = require("mongoose");
const quietServerLogs = process.env.QUIET_SERVER_LOGS === "1";

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 10000,
            maxPoolSize: 10
        });

        if (!quietServerLogs) {
            console.log("MongoDB connected");
        }
    } catch (error) {
        console.error("Database connection failed:", error.message);
        process.exit(1);
    }
};

module.exports = connectDB;
