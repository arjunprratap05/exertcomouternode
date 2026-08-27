const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const dns = require('node:dns');
const cronController = require('./controllers/cronJobs');
const omniWebhooks = require('./routes/omniWebhooks');

// --- THE VERCEL FIX: Only run dotenv in local development ---
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config(); 
}

dns.setServers(['1.1.1.1', '8.8.8.8']);

const app = express();

// --- CRITICAL VERCEL PROXY FIX ---
// Tells Express to trust reverse proxy headers (X-Forwarded-For) from Vercel
app.set('trust proxy', 1);

// --- 1. CORS CONFIGURATION (Fortified for Vercel) ---
const allowedOrigins = [
    process.env.FRONTEND_URL,
].filter(Boolean); // Removes any undefined values

const corsOptions = {
    origin: allowedOrigins, 
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'], 
    credentials: true,
};
app.use(cors(corsOptions));

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

// --- 4. ROBUST DATABASE CONNECTION (Serverless Cached) ---
let isConnected = false;
const connectDB = async () => {
    // If already connected, skip
    if (isConnected || mongoose.connection.readyState === 1) {
        isConnected = true;
        return;
    }
    
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 5000,
            maxPoolSize: 10, // Optimized for serverless
        });
        isConnected = true;
        console.log("✅ Expert Academy Database Connected");
    } catch (err) {
        console.error("❌ MongoDB Connection Error:", err.message);
        throw err; // Force the middleware to catch this
    }
};

// CRITICAL VERCEL FIX: Force DB connection BEFORE handling any routes
app.use(async (req, res, next) => {
    try {
        await connectDB();
        next();
    } catch (error) {
        return res.status(500).json({ 
            success: false, 
            msg: "Database connection failed or timed out." 
        });
    }
});

// Connect immediately on boot/invocation
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
app.get('/api/cron/monthly-report', cronController.triggerMonthlyReport);
app.use('/webhooks', omniWebhooks);

// Health Check
app.get('/', (req, res) => {
    res.json({ message: "Expert Academy API is live", status: 200 });
});

// --- 6. GLOBAL ERROR HANDLER ---
app.use((err, req, res, next) => {
    console.error(`[Error]: ${err.message}`);
    res.status(err.status || 500).json({ 
        success: false, 
        msg: err.message || "System encountered an Internal Directory Error" 
    });
});

// --- 7. VERCEL SERVERLESS EXPORT vs LOCAL LISTEN ---
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => console.log(`🚀 Expert Academy API running locally on port ${PORT}`));
}

// Export the pure Express app for Vercel's serverless functions
module.exports = app;