const Student = require('../models/student');
const Inquiry = require('../models/Inquiry');
const AuditLog = require('../models/AuditLog');
const Batch = require('../models/Batch');
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
            performedBy: req.user?.role?.toUpperCase(), // Changed req.admin to req.user
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
            performedBy: req.user?.role?.toUpperCase(), // Changed req.admin to req.user
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
        // CHANGE: Expecting batchIds (Array) from the checkbox list in AdminDashboard
        const { batchIds } = req.body; 
        const student = await Student.findById(req.params.id);

        if (!student) return res.status(404).json({ success: false, message: "Student not found" });

        // --- MULTI-STREAM HISTORY LOGIC ---
        // We track any batch that is being removed from the 'activeBatches' list
        if (student.activeBatches && student.activeBatches.length > 0) {
            
            // Find IDs that were in the old list but are NOT in the new list
            const removedBatches = student.activeBatches.filter(oldId => !batchIds.includes(oldId.toString()));

            for (const oldBatchId of removedBatches) {
                const oldBatch = await Batch.findById(oldBatchId);
                
                student.batchHistory.push({
                    batchId: oldBatchId,
                    batchCode: oldBatch?.batchCode || "Dead/Deleted Batch",
                    shiftedAt: new Date(),
                    reason: "Topic Stream De-authorized or Shifted"
                });
            }
        }

        // --- SYNC NEW STATE ---
        // 1. Assign the new Array of authorized streams
        student.activeBatches = batchIds;
        
        // 2. Backward Compatibility: Set the first batch as the 'primary' batchId for old components
        student.batchId = batchIds[0]; 

        // 3. Update Status
        student.isApproved = true;
        student.status = 'Enrolled';

        await student.save();

        // --- AUDIT LOG ---
        await AuditLog.create({
            action: "Multi-Stream Authorization",
            performedBy: req.user?.username,
            targetName: student.name,
            details: `Authorized Streams: ${batchIds.length}`
        });

        res.json({ 
            success: true, 
            message: "Student authorized for selected topic streams",
            count: batchIds.length 
        });

    } catch (err) {
        console.error("Authorization Error:", err);
        res.status(500).json({ success: false, message: "Sync Failure" });
    }
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

exports.createBatch = async (req, res) => {
    try {
        const batchData = {
            ...req.body,
            lastModifiedBy: req.user.username // Extracted from JWT
        };
        const newBatch = new Batch(batchData);
        await newBatch.save();
        
        // Log to Audit System
        await AuditLog.create({
            action: "Batch Created",
            performedBy: req.user.role.toUpperCase(),
            targetName: req.body.batchCode,
            details: `Created by staff: ${req.user.username}`
        });

        res.status(201).json({ success: true, data: newBatch });
    } catch (err) { 
        res.status(400).json({ success: false, message: "Sync Failed: Batch Code must be unique" }); 
    }
};

// Get Batches for AddLecture Dropdown
exports.getActiveBatches = async (req, res) => {
    try {
        const batches = await Batch.find({ active: true }).sort({ createdAt: -1 });
        res.json({ success: true, data: batches });
    } catch (err) { 
        res.status(500).json({ success: false }); 
    }
};

exports.deleteBatch = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedBatch = await Batch.findByIdAndDelete(id);

        if (!deletedBatch) {
            return res.status(404).json({ success: false, message: "Batch not found" });
        }

        // Optional: Add to Audit Log
        await AuditLog.create({
            action: "Batch Deleted",
            performedBy: req.user?.username,
            targetName: deletedBatch.batchCode,
            details: `Deleted by ${req.user?.username}`
        });

        res.json({ success: true, message: "Batch removed successfully" });
    } catch (err) {
        res.status(500).json({ success: false, message: "Server Error during deletion" });
    }
};

exports.grantPortalAccess = async (req, res) => {
    try {
        const student = await Student.findById(req.params.id);
        if (!student) return res.status(404).json({ success: false, message: "Student not found" });

        student.isPortalActive = true; // Flips the switch
        await student.save();

        await AuditLog.create({
            action: "Portal Access Activated",
            performedBy: req.user?.username,
            targetName: student.name,
            details: `Account enabled for ID: ${student.registrationId}`
        });

        res.json({ success: true, message: "Student portal activated" });
    } catch (err) {
        res.status(500).json({ success: false });
    }
};

exports.updateLedger = async (req, res) => {
    try {
        const { id } = req.params;
        const { amountPaid, totalFee, auditAction, targetName } = req.body;
        
        const updateData = {};
        if (amountPaid !== undefined) updateData.amountPaid = amountPaid;
        if (totalFee !== undefined) updateData.totalFee = totalFee;

        const updatedStudent = await Student.findByIdAndUpdate(
            id,
            { $set: updateData },
            { new: true }
        );

        if (!updatedStudent) {
            return res.status(404).json({ success: false, message: "Student not found" });
        }

        // --- FIXED LOGIC START ---
        // 1. Get the name or fallback to the Role (Founder/Accounts)
        // 2. We capitalize the first letter to make it look professional in the dashboard
        const userRole = req.user.role ? req.user.role.charAt(0).toUpperCase() + req.user.role.slice(1) : "Admin";
        const adminIdentifier = req.user.name || userRole;

        const newLog = new AuditLog({
            performedBy: adminIdentifier, // This will now show "Founder" or "Accounts"
            action: auditAction || "Ledger Updated",
            targetName: targetName || updatedStudent.name,
            timestamp: new Date()
        });
        // --- FIXED LOGIC END ---

        await newLog.save();

        res.status(200).json({
            success: true,
            message: "Ledger synchronized successfully",
            data: updatedStudent
        });
    } catch (error) {
        console.error("Ledger Update Error:", error);
        res.status(500).json({ success: false, message: "Server Error during sync" });
    }
};