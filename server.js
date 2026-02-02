const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

dotenv.config(); 

const app = express();

// --- 1. SECURITY & UTILITY MIDDLEWARE ---
app.use(helmet()); 
app.use(express.json({ limit: '10mb' })); 

// --- 2. AUTH-SPECIFIC RATE LIMITER (Fixed 429 Issue) ---
// Increased max attempts to 20 per 5 minutes for better testing flexibility
const otpLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, 
    max: 20, 
    standardHeaders: true, 
    legacyHeaders: false,
    message: { 
        success: false, 
        msg: "Security block: Too many OTP attempts from this device. Please wait 5 minutes." 
    }
});

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ Expert Academy Database Connected"))
    .catch(err => {
        console.error("❌ MongoDB Connection Error:", err);
        process.exit(1); 
    });

const corsOptions = {
    origin: process.env.FRONTEND_URL, 
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    credentials: true,
};
app.use(cors(corsOptions));

// --- 3. ROUTES ---
app.use('/api/auth', otpLimiter, require('./routes/authRoutes')); 
app.use('/api/registration', require('./routes/registrationRoutes')); 
app.use('/api/inquiry', require('./routes/inquiryRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/assistant', require('./routes/assistantRoutes'));

app.get('/', (req, res) => {
    res.json({ message: "Expert Academy API is live", status: 200 });
});

// --- 4. GLOBAL ERROR HANDLER ---
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ success: false, msg: "Internal Server Error" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Expert Academy API running on port ${PORT}`));