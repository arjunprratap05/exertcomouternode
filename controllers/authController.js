const nodemailer = require('nodemailer');
const crypto = require('crypto');
const bcrypt = require('bcryptjs'); 
const jwt = require('jsonwebtoken'); 
const Student = require('../models/student'); 
const AuditLog = require('../models/AuditLog'); 

const otpStore = new Map();

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS 
    }
});

const sendOTPEmail = async (email, otp) => {
    const mailOptions = {
        from: `"Expert Academy" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Verification Token - Expert Academy",
        html: `<div style="font-family: Arial; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #1A5F7A;">Security Verification</h2>
                <p>Your OTP is: <b style="color: #F37021; font-size: 24px;">${otp}</b></p>
               </div>`
    };
    return transporter.sendMail(mailOptions);
};

exports.studentLogin = async (req, res) => {
    try {
        const { registrationId, password } = req.body;
        const student = await Student.findOne({ 
            registrationId: { $regex: new RegExp(`^${registrationId.trim()}$`, 'i') } 
        });

        if (!student) return res.status(401).json({ success: false, msg: "Invalid ID" });
        
        const isMatch = await bcrypt.compare(password, student.password);
        if (!isMatch) return res.status(401).json({ success: false, msg: "Invalid Password" });

        // TOKEN MUST INCLUDE BATCHID
        const token = jwt.sign(
            { id: student._id, role: 'student', course: student.course, batchId: student.batchId }, 
            process.env.JWT_SECRET, 
            { expiresIn: '24h' }
        );

        res.json({ success: true, token, student });
    } catch (error) {
        res.status(500).json({ success: false, msg: "Server Error" });
    }
};

exports.sendOTP = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ success: false, msg: "Email required" });

        const otp = crypto.randomInt(100000, 999999).toString();
        otpStore.set(email, { otp, expires: Date.now() + 300000 });

        await sendOTPEmail(email, otp);
        res.status(200).json({ success: true, msg: "OTP Sent" });
    } catch (error) {
        res.status(500).json({ success: false, msg: "Email failed" });
    }
};

exports.verifyOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;
        const record = otpStore.get(email);
        if (record && record.otp === otp && record.expires > Date.now()) {
            otpStore.delete(email);
            return res.status(200).json({ success: true, msg: "Verified" });
        }
        res.status(400).json({ success: false, msg: "Invalid or expired OTP" });
    } catch (error) {
        res.status(500).json({ success: false });
    }
};

exports.forgotPasswordRequest = async (req, res) => {
    try {
        const { registrationId } = req.body;
        
        const student = await Student.findOne({ 
            registrationId: { $regex: new RegExp(`^${registrationId.trim()}$`, 'i') } 
        });

        if (!student) {
            return res.status(404).json({ success: false, msg: "Registration ID not found" });
        }

        const otp = crypto.randomInt(100000, 999999).toString();
        // Use student email from DB as the key for OTP
        otpStore.set(student.email, { otp, expires: Date.now() + 300000 });

        await transporter.sendMail({
            from: `"Expert Academy" <${process.env.EMAIL_USER}>`,
            to: student.email,
            subject: "Password Reset OTP",
            html: `<div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee;">
                    <h2>Expert Academy Password Reset</h2>
                    <p>Your OTP is: <b style="font-size: 24px; color: #F37021;">${otp}</b></p>
                    <p>This code expires in 5 minutes.</p>
                   </div>`
        });

        res.json({ success: true, msg: "OTP sent to your registered email" });
    } catch (error) {
        console.error("Forgot Pass Error:", error);
        res.status(500).json({ success: false, msg: "Failed to send email" });
    }
};

// --- RESET PASSWORD ACTION ---
exports.resetPasswordWithOTP = async (req, res) => {
    try {
        const { registrationId, otp, newPassword } = req.body;

        const student = await Student.findOne({ 
            registrationId: { $regex: new RegExp(`^${registrationId.trim()}$`, 'i') } 
        });

        if (!student) return res.status(404).json({ success: false, msg: "Student not found" });

        const record = otpStore.get(student.email);
        
        if (!record || record.otp !== otp || record.expires < Date.now()) {
            return res.status(400).json({ success: false, msg: "Invalid or expired OTP" });
        }

        student.password = await bcrypt.hash(newPassword, 10);
        await student.save();
        otpStore.delete(student.email);

        res.json({ success: true, msg: "Password updated successfully" });
    } catch (error) {
        res.status(500).json({ success: false, msg: "Reset failed" });
    }
};

exports.studentLogout = async (req, res) => {
    try {
        const { studentId } = req.body;
        
        await AuditLog.create({
            action: 'LOGOUT',
            performedBy: 'STUDENT',
            targetId: studentId,
            details: 'Student logged out of the ERP portal'
        });

        res.json({ success: true, msg: "Logged out successfully" });
    } catch (error) {
        res.status(500).json({ success: false });
    }
};

exports.getStudentProfile = async (req, res) => {
    try {
        const student = await Student.findById(req.user.id).select('-password');
        res.json({ success: true, student });
    } catch (err) {
        res.status(500).json({ success: false });
    }
};