const Student = require('../models/student');
const Inquiry = require('../models/Inquiry');
const AuditLog = require('../models/AuditLog');
const jwt = require('jsonwebtoken');

// --- 1. ADMIN LOGIN ---
exports.adminLogin = async (req, res) => {
    try {
        const { username, password } = req.body;
        let role = null;
        if (username === process.env.FOUNDER_USER && password === process.env.FOUNDER_PASS) role = 'founder';
        else if (username === process.env.ACCOUNTS_USER && password === process.env.ACCOUNTS_PASS) role = 'accounts';
        else if (username === process.env.FRONTOFFICE_USER && password === process.env.FRONTOFFICE_PASS) role = 'frontoffice';

        if (role) {
            const token = jwt.sign({ role, username }, process.env.JWT_SECRET, { expiresIn: '12h' });
            return res.json({ success: true, token, role });
        }
        res.status(401).json({ success: false, message: "Invalid Credentials" });
    } catch (err) { res.status(500).json({ success: false }); }
};

// --- 2. ACCOUNTS: Payment Sync with Performer Tracking ---
exports.updateStudentPayment = async (req, res) => {
    try {
        const { id } = req.params;
        const { amountPaid, paymentLog } = req.body; 
        const student = await Student.findById(id);
        if (!student) return res.status(404).json({ success: false });

        await Student.findByIdAndUpdate(id, { amountPaid });

        await AuditLog.create({
            action: "Payment Updated",
            performedBy: req.admin?.role?.toUpperCase() || "ACCOUNTS", 
            targetName: student.name,
            details: `RECEIVED ₹${paymentLog?.amount || 0} VIA ${paymentLog?.mode?.toUpperCase() || 'CASH'} (REF: ${paymentLog?.transactionId || 'N/A'}).`
        });
        res.json({ success: true }); 
    } catch (err) { res.status(500).json({ success: false }); }
};

// --- 3. DATA FETCHERS WITH TROPHY & CHART ANALYTICS ---
exports.getAuditLogs = async (req, res) => {
    try {
        const logs = await AuditLog.find().sort({ timestamp: -1 }).limit(500);
        const revenueLogs = await AuditLog.find({ action: "Payment Updated" });
        const totalRevenue = revenueLogs.reduce((acc, log) => {
            const match = log.details.match(/₹(\d+)/);
            return acc + (match ? parseInt(match[1]) : 0);
        }, 0);

        // RANKED ANALYTICS (Best Sellers)
        const students = await Student.find();
        const courseCounts = students.reduce((acc, s) => {
            const course = s.course || "General Inquiry";
            acc[course] = (acc[course] || 0) + 1;
            return acc;
        }, {});

        const top3Courses = Object.entries(courseCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([title, count]) => ({ title, count }));

        // REJECTION BREAKDOWN FOR FOUNDER CHART
        const rejectionLogs = await AuditLog.find({ action: "Lead Rejected" });
        const reasonCounts = rejectionLogs.reduce((acc, log) => {
            const reason = log.details.replace("REJECTION REASON: ", "") || "Not Stated";
            acc[reason] = (acc[reason] || 0) + 1;
            return acc;
        }, {});
        const reasonBreakdown = Object.entries(reasonCounts).map(([name, value]) => ({ name, value }));

        res.json({ success: true, logs, totalRevenue, top3Courses, reasonBreakdown });
    } catch (err) { res.status(500).json({ success: false }); }
};

// --- 4. FRONTOFFICE: Evaluation with Staff Metadata ---
exports.updateEnquiryStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { enrolled, reason } = req.body; 
        const inquiry = await Inquiry.findByIdAndUpdate(id, { enrolled }, { new: true });
        
        if (!inquiry) return res.status(404).json({ success: false });

        await AuditLog.create({
            action: enrolled ? "Lead Conversion" : "Lead Rejected",
            performedBy: req.admin?.role?.toUpperCase() || "FRONTOFFICE",
            targetName: inquiry.name,
            details: enrolled 
                ? "STAFF REDIRECTED TO REGISTRATION PAGE TO COMPLETE FULL PROFILE" 
                : `REJECTION REASON: ${reason || 'NOT STATED'}`
        });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
};

exports.getAllStudents = async (req, res) => {
    const data = await Student.find().sort({ createdAt: -1 });
    res.json({ success: true, data });
};

exports.getEnquiries = async (req, res) => {
    const data = await Inquiry.find().sort({ createdAt: -1 });
    res.json({ success: true, data });
};