const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const dns = require('node:dns');
const http = require('http'); // <-- NEW: Required for Socket.io
const { Server } = require('socket.io'); // <-- NEW: Required for Socket.io

dns.setServers(['1.1.1.1', '8.8.8.8']);

dotenv.config(); 

const app = express();

// --- NEW: WRAP EXPRESS IN HTTP SERVER ---
const server = http.createServer(app);

// --- NEW: CONFIGURE SOCKET.IO ---
const io = new Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:5173", 
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
        credentials: true
    }
});

// Make 'io' globally accessible so controllers (like your WhatsApp controller) can emit events
app.set('io', io);

// --- 1. SECURITY & UTILITY MIDDLEWARE ---
app.use(helmet()); 
// Limit increased to 10mb to support large PDF uploads/Audit history
app.use(express.json({ limit: '10mb' })); 

// --- 2. AUTH-SPECIFIC RATE LIMITER ---
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

// --- 3. CORS CONFIGURATION (Critical for Multi-Course Patching) ---
const corsOptions = {
    origin: process.env.FRONTEND_URL || "http://localhost:5173", 
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'], // Ensure PATCH is allowed
    credentials: true,
};
app.use(cors(corsOptions));

// --- 4. ROBUST DATABASE CONNECTION ---
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 5000,
        });
        console.log("✅ Expert Academy Database Connected");
    } catch (err) {
        console.error("❌ MongoDB Connection Error:", err.message);
        setTimeout(connectDB, 5000); 
    }
};
connectDB();

// --- 5. ROUTES ---
// OTP Limiter applied only to Auth (Login/Forgot Pass)
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
        msg: err.message || "System encountered an Internal Directory Error" 
    });
});

const PORT = process.env.PORT || 5000;

// --- CHANGED: Use server.listen instead of app.listen ---
server.listen(PORT, () => console.log(`🚀 Expert Academy API running on port ${PORT}`));