const Student = require('../models/student');
const Inquiry = require('../models/Inquiry');
const AuditLog = require('../models/AuditLog');
const jwt = require('jsonwebtoken');

// --- 1. ADMIN LOGIN ---
exports.adminLogin = async (req, res) => {
    try {
        const { username, password } = req.body;
        let role = null;
        
        // Environment Variable Check
        if (username === process.env.FOUNDER_USER && password === process.env.FOUNDER_PASS) role = 'founder';
        else if (username === process.env.ACCOUNTS_USER && password === process.env.ACCOUNTS_PASS) role = 'accounts';
        else if (username === process.env.FRONTOFFICE_USER && password === process.env.FRONTOFFICE_PASS) role = 'frontoffice';

        if (role) {
            // Include role in token
            const token = jwt.sign({ role, username }, process.env.JWT_SECRET, { expiresIn: '12h' });
            return res.json({ success: true, token, role });
        }
        res.status(401).json({ success: false, message: "Invalid Credentials" });
    } catch (err) { 
        res.status(500).json({ success: false, message: "Server Error" }); 
    }
};

// --- 2. PAYMENT UPDATE ---
exports.updateStudentPayment = async (req, res) => {
    try {
        const { id } = req.params;
        const { amountPaid, paymentLog } = req.body; 
        const student = await Student.findById(id);
        if (!student) return res.status(404).json({ success: false });

        await Student.findByIdAndUpdate(id, { amountPaid });

        await AuditLog.create({
            action: "Payment Updated",
            performedBy: req.user?.role?.toUpperCase() || "ACCOUNTS", // Changed req.admin to req.user
            targetName: student.name,
            details: `Received ₹${paymentLog?.amount || 0} via ${paymentLog?.mode || 'N/A'}`
        });
        res.json({ success: true }); 
    } catch (err) { res.status(500).json({ success: false }); }
};

// --- 3. ENQUIRY STATUS ---
exports.updateEnquiryStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { enrolled, reason } = req.body; 
        const inquiry = await Inquiry.findByIdAndUpdate(id, { enrolled }, { new: true });
        
        if (!inquiry) return res.status(404).json({ success: false });

        await AuditLog.create({
            action: enrolled ? "Lead Conversion" : "Lead Rejected",
            performedBy: req.user?.role?.toUpperCase() || "FRONTOFFICE", // Changed req.admin to req.user
            targetName: inquiry.name,
            details: enrolled ? "Converted to student" : `Reason: ${reason || 'N/A'}`
        });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
};

// --- 4. AUDIT LOGS & ANALYTICS ---
exports.getAuditLogs = async (req, res) => {
    try {
        const logs = await AuditLog.find().sort({ timestamp: -1 }).limit(100);
        const students = await Student.find();
        const totalRevenue = students.reduce((acc, s) => acc + (Number(s.amountPaid) || 0), 0);
        res.json({ success: true, logs, totalRevenue });
    } catch (err) { res.status(500).json({ success: false }); }
};

// --- 5. STUDENT APPROVAL ---
exports.approveStudent = async (req, res) => {
    try {
        const student = await Student.findByIdAndUpdate(req.params.id, { isApproved: true }, { new: true });
        if (!student) return res.status(404).json({ success: false });

        await AuditLog.create({
            action: "Student Approved",
            performedBy: req.user?.role || "ADMIN", // Changed req.admin to req.user
            targetName: student.name,
            details: `Approved Registration: ${student.registrationId}`
        });
        res.json({ success: true, msg: "Student Approved" });
    } catch (err) { res.status(500).json({ success: false }); }
};

// --- 6. DATA FETCHERS ---
exports.getAllStudents = async (req, res) => {
    try {
        const data = await Student.find().sort({ createdAt: -1 });
        res.json({ success: true, data });
    } catch (err) { res.status(500).json({ success: false }); }
};

exports.getEnquiries = async (req, res) => {
    try {
        const data = await Inquiry.find().sort({ createdAt: -1 });
        res.json({ success: true, data });
    } catch (err) { res.status(500).json({ success: false }); }
};

exports.getPendingStudents = async (req, res) => {
    try {
        const pending = await Student.find({ isApproved: false }).sort({ createdAt: -1 });
        res.json({ success: true, data: pending });
    } catch (err) { res.status(500).json({ success: false }); }
};