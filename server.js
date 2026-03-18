const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

dotenv.config();

const app = express();

app.use(helmet());
app.use(express.json({ limit: '10mb' }));

// --- CORS Configuration ---
const corsOptions = {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    credentials: true,
};
app.use(cors(corsOptions));

// --- SERVERLESS DATABASE CONNECTION ---
// On Vercel, we must cache the connection to prevent "Too many connections" errors
let isConnected = false;

const connectDB = async () => {
    mongoose.set('strictQuery', true);
    if (isConnected) return;

    try {
        const db = await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 5000,
        });
        isConnected = db.connections[0].readyState;
        console.log("✅ Database Connected");
    } catch (err) {
        console.error("❌ MongoDB Error:", err.message);
        // Do not throw error here, let the request attempt to proceed or fail gracefully
    }
};

// Middleware to ensure DB is connected before handling routes
app.use(async (req, res, next) => {
    await connectDB();
    next();
});

// --- ROUTES ---
app.use('/api/auth', require('./routes/authRoutes')); 
app.use('/api/registration', require('./routes/registrationRoutes')); 
app.use('/api/inquiry', require('./routes/inquiryRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/assistant', require('./routes/assistantRoutes'));
app.use('/api/lms', require('./routes/lmsRoutes'));

app.get('/', (req, res) => {
    res.json({ message: "Expert Academy API is live", status: 200 });
});

// --- GLOBAL ERROR HANDLER ---
app.use((err, req, res, next) => {
    res.status(err.status || 500).json({ 
        success: false, 
        msg: err.message || "Internal Server Error" 
    });
});

// CRITICAL FOR VERCEL: Export the app instead of calling app.listen()
// Vercel uses this export to wrap the app in a serverless function
module.exports = app;

// Keep this for local development only
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => console.log(`🚀 Local Server on port ${PORT}`));
}