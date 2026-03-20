const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const compression = require('compression'); // New: Compresses JSON payloads

dotenv.config(); 

const app = express();

// --- 1. PERFORMANCE & SECURITY MIDDLEWARE ---
app.use(helmet()); 
app.use(compression()); // Reduces payload size for faster transit
app.use(express.json({ limit: '10mb' })); 

// --- 2. CACHED DATABASE CONNECTION (Critical for Vercel) ---
let cachedConnection = null;

const connectDB = async () => {
    if (cachedConnection && mongoose.connection.readyState === 1) {
        return cachedConnection;
    }

    try {
        // Optimization: Use lean queries by default where possible in controllers
        mongoose.set('slim', true); 
        
        cachedConnection = await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 5000,
            maxPoolSize: 10, // Maintain a small pool for serverless
            socketTimeoutMS: 45000,
        });
        console.log("✅ DB Connected");
        return cachedConnection;
    } catch (err) {
        console.error("❌ MongoDB Error:", err.message);
    }
};

// Middleware to ensure DB is ready before any route logic
app.use(async (req, res, next) => {
    await connectDB();
    next();
});

// --- 3. CORS CONFIGURATION ---
app.use(cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173", 
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    credentials: true,
}));

// --- 4. ROUTES ---
app.use('/api/auth', require('./routes/authRoutes')); 
app.use('/api/registration', require('./routes/registrationRoutes')); 
app.use('/api/inquiry', require('./routes/inquiryRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/assistant', require('./routes/assistantRoutes'));
app.use('/api/lms', require('./routes/lmsRoutes'));

app.get('/', (req, res) => {
    res.status(200).json({ status: "online" });
});

// --- 5. EXPORT FOR VERCEL ---
module.exports = app;

// Only listen if running locally
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => console.log(`🚀 Local: http://localhost:${PORT}`));
}