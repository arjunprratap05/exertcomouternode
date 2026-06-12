const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const dns = require('node:dns');

// Only run dotenv in local development
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config(); 
}

dns.setServers(['1.1.1.1', '8.8.8.8']);

const app = express();

// --- 1. CORS CONFIGURATION ---
const allowedOrigins = [
    process.env.FRONTEND_URL,
    
].filter(Boolean);

app.use(cors({
    origin: allowedOrigins, 
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'], 
    credentials: true,
}));

// --- 2. SECURITY & UTILITY MIDDLEWARE ---
app.use(helmet()); 
app.use(express.json({ limit: '10mb' })); 

// --- 3. AUTH-SPECIFIC RATE LIMITER ---
const otpLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, 
    max: 20, 
    standardHeaders: true, 
    legacyHeaders: false,
    message: { 
        success: false, 
        msg: "Security block: Too many OTP attempts. Please wait 5 minutes." 
    }
});

// --- 4. ROBUST DATABASE CONNECTION ---
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 5000,
        });
        console.log("✅ Expert Academy Database Connected");
    } catch (err) {
        console.error("❌ MongoDB Connection Error:", err.message);
        // Do not use recursive setTimeout in serverless environments, 
        // it can cause function timeouts. Just log the error.
    }
};
connectDB();

// --- 5. ROUTES ---
app.use('/api/auth', otpLimiter, require('./routes/authRoutes')); 
app.use('/api/registration', require('./routes/registrationRoutes')); 
app.use('/api/inquiry', require('./routes/inquiryRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/assistant', require('./routes/assistantRoutes'));
app.use('/api/lms', require('./routes/lmsRoutes'));
app.use('/api', require('./routes/quizRoutes'));
app.use('/api/whatsapp', require('./routes/whatsappRoutes'));

// Health Check
app.get('/', (req, res) => {
    res.json({ message: "Expert Academy API is live", status: 200 });
});

// --- 6. GLOBAL ERROR HANDLER ---
app.use((err, req, res, next) => {
    console.error(`[Error]: ${err.message}`);
    res.status(err.status || 500).json({ 
        success: false, 
        msg: err.message || "System encountered an Internal Server Error" 
    });
});

// --- 7. VERCEL EXPORT ---
// Instead of server.listen(), we export the app for Vercel Serverless
module.exports = app;

// Allow local development testing
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => console.log(`🚀 Local dev server running on port ${PORT}`));
}