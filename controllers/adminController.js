const Student = require('../models/student');
const Inquiry = require('../models/Inquiry');
const AuditLog = require('../models/AuditLog');
const Batch = require('../models/Batch');
const jwt = require('jsonwebtoken');
const Message = require('../models/Message');
const { sendWhatsAppMessage } = require('../services/whatsappService');
const nodemailer = require('nodemailer');
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
        const { id } = req.params;
        const { transactionId } = req.body; // Sent from frontend verify button
        
        const student = await Student.findById(id);
        if (!student) return res.status(404).json({ message: "Student not found" });

        // 1. Check if we are approving a specific enrollment in the array
        if (transactionId && student.enrollments && student.enrollments.length > 0) {
            const enrollIndex = student.enrollments.findIndex(e => e.transactionId === transactionId);
            
            if (enrollIndex !== -1) {
                student.enrollments[enrollIndex].paymentStatus = 'VERIFIED';
                student.enrollments[enrollIndex].status = 'Enrolled';
            }
        }

        // 2. Sync with Legacy Fields (Ensure UI stays consistent)
        // If this is the first/only enrollment being verified, unlock the portal
        student.isApproved = true;
        student.isPortalActive = true;
        
        // 3. Save with validation disabled to prevent "Missing Field" errors from old data
        await student.save({ validateBeforeSave: false });

        res.status(200).json({ success: true, message: "Verification Successful" });
    } catch (error) {
        console.error("APPROVE_ERROR:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};
// --- 6. DATA FETCHERS ---
exports.getAllStudents = async (req, res) => {
    try {
        const students = await Student.find()
            .populate('activeBatches')
            .sort({ createdAt: -1 });
        
        res.status(200).json({ success: true, data: students });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
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
        const batchId = req.params.id;
        await Batch.findByIdAndDelete(batchId);

        // AUTO-CLEANUP: If a batch is deleted, remove it from all students
        await Student.updateMany(
            {}, 
            { $pull: { activeBatches: batchId } }
        );

        res.json({ success: true, message: "Batch wiped and student access revoked" });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.grantPortalAccess = async (req, res) => {
    try {
        const student = await Student.findById(req.params.id);
        if (!student) {
            return res.status(404).json({ success: false, message: "Student not found" });
        }

        // Aligning with the frontend 'isApproved' check for portal access status
        student.isApproved = true; 
        
        // If your schema strictly relies on isPortalActive, uncomment the line below 
        // to sync both flags, or update the React frontend to check 'isPortalActive'.
        // student.isPortalActive = true; 

        await student.save();

        await AuditLog.create({
            action: "Portal Access Activated",
            performedBy: req.user?.username || "System",
            targetName: student.name,
            details: `Account enabled manually/auto for ID: ${student._id}`
        });

        res.json({ success: true, message: "Student portal activated successfully" });
    } catch (err) {
        console.error("Error granting portal access:", err);
        res.status(500).json({ success: false, message: "Server Error during portal unlock" });
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

exports.requestDiscount = async (req, res) => {
    try {
        const { id } = req.params;
        const { amount, reason, targetName } = req.body;

        const student = await Student.findByIdAndUpdate(
            id,
            {
                discountRequest: {
                    amount: Number(amount),
                    reason: reason,
                    status: 'PENDING',
                    requestedAt: new Date()
                }
            },
            { new: true }
        );

        // Log the request in the Audit system
        await AuditLog.create({
            performedBy: req.user.role.toUpperCase(),
            action: `Discount Requested: ₹${amount}`,
            targetName: targetName || student.name,
            timestamp: new Date()
        });

        res.status(200).json({ success: true, message: "Request sent to Founder" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ACTION: Founder Approves and actually changes the Total Fee
exports.approveDiscount = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Security Check: Ensure only Founder can call this
        if (req.user.role !== 'founder') {
            return res.status(403).json({ success: false, message: "Founder clearance required" });
        }

        const student = await Student.findById(id);
        if (!student || student.discountRequest.status !== 'PENDING') {
            return res.status(400).json({ success: false, message: "No pending request found" });
        }

        const discountValue = student.discountRequest.amount;

        // Apply financial change: Deduct from totalFee
        student.totalFee -= discountValue;
        student.discountRequest.status = 'APPROVED';
        
        await student.save();

        // Log the final authorization
        await AuditLog.create({
            performedBy: "FOUNDER",
            action: `Discount Authorized: -₹${discountValue}`,
            targetName: student.name,
            timestamp: new Date()
        });

        res.status(200).json({ success: true, message: "Discount applied to ledger" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.approveStudent = async (req, res) => {
    try {
        const { id } = req.params;
        const student = await Student.findById(id);

        if (!student) {
            return res.status(404).json({ success: false, message: "Student not found" });
        }

        // 1. Mark as Verified
        student.paymentStatus = 'VERIFIED';
        student.isPortalActive = true;
        student.isApproved = true;

        // 2. SYNC THE LEDGER (The fix you asked for)
        // If it was a FULL payment, amountPaid becomes totalFee.
        // If it was PARTIAL, you might want to add only the first installment.
        if (student.paymentOption === 'FULL') {
            student.amountPaid = student.totalFee;
        } else if (student.paymentOption === 'PARTIAL') {
            // For partial, we assume the first EMI is paid now.
            // Calculation: Total / Months (Match your React frontend logic)
            const firstInstallment = Math.round(student.totalFee / (student.emiMonths || 1));
            student.amountPaid = (student.amountPaid || 0) + firstInstallment;
        }
        // Note: For CASH, amountPaid stays 0 until you manually update it 
        // OR you can set it to the total if you received full cash.

        // 3. Update Enrollment status
        if (student.enrollments && student.enrollments.length > 0) {
            student.enrollments[student.enrollments.length - 1].status = 'Enrolled';
        }

        await student.save();

        res.status(200).json({ 
            success: true, 
            message: `Payment verified. Amount Paid: ₹${student.amountPaid} updated.` 
        });

    } catch (error) {
        console.error("APPROVE_STUDENT_ERROR:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

exports.authorizeStudentBatch = async (req, res) => {
    try {
        const studentId = req.params.id;
        const { batchId, targetName } = req.body;

        if (!batchId) return res.status(400).json({ success: false, message: "Batch ID missing" });

        // Update student using $addToSet (prevents duplicates)
        const student = await Student.findByIdAndUpdate(
            studentId,
            { $addToSet: { activeBatches: batchId } },
            { new: true }
        ).populate('activeBatches');

        if (!student) return res.status(404).json({ success: false, message: "Student record not found" });

        res.status(200).json({ 
            success: true, 
            message: `Student authorized for ${targetName || 'Batch'}`,
            data: student.activeBatches 
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.getWhatsAppLeads = async (req, res) => {
    try {
        // Fetch all students who have a phone number (acting as WhatsApp leads)
        // Sorting by newest first
        const leads = await Student.find({ phone: { $exists: true, $ne: null } })
            .select('name phone leadStatus isAiControlled updatedAt')
            .sort({ updatedAt: -1 })
            .limit(50);
            
        res.status(200).json({ success: true, data: leads });
    } catch (error) {
        console.error("Error fetching leads:", error);
        res.status(500).json({ success: false, msg: "Failed to fetch WhatsApp leads" });
    }
};

exports.getWhatsAppChat = async (req, res) => {
    try {
        const { phone } = req.params;
        
        // Fetch conversation history and sort chronologically (oldest to newest for UI)
        const chatHistory = await Message.find({ phoneNumber: phone })
            .sort({ timestamp: 1 });
            
        res.status(200).json({ success: true, data: chatHistory });
    } catch (error) {
        console.error("Error fetching chat:", error);
        res.status(500).json({ success: false, msg: "Failed to fetch chat history" });
    }
};

exports.toggleAiControl = async (req, res) => {
    try {
        const { id } = req.params;
        const { isAiControlled } = req.body;
        
        await Student.findByIdAndUpdate(id, { isAiControlled });
        
        res.status(200).json({ success: true, msg: `AI Control set to ${isAiControlled}` });
    } catch (error) {
        console.error("Error toggling AI:", error);
        res.status(500).json({ success: false, msg: "Failed to toggle AI status" });
    }
};

exports.sendManualWhatsAppMessage = async (req, res) => {
    try {
        const { phone, message } = req.body;
        
        if (!phone || !message) {
            return res.status(400).json({ success: false, msg: "Phone and message are required" });
        }

        // 1. Send via Meta API
        await sendWhatsAppMessage(phone, message);

        // 2. Save to database as an 'agent' message
        const savedMessage = await Message.create({
            phoneNumber: phone,
            sender: 'agent',
            text: message
        });

        // 3. Emit via Socket.io so other admin screens update instantly
        const io = req.app.get('io');
        if (io) {
            io.emit('new_whatsapp_message', { phone, text: message, sender: 'agent' });
        }

        res.status(200).json({ success: true, data: savedMessage });
    } catch (error) {
        console.error("Error sending manual message:", error);
        res.status(500).json({ success: false, msg: "Failed to send message" });
    }
};

exports.approvePayment = async (req, res) => {
    const { studentId } = req.params;
    const { transactionId } = req.body;

    // This is the key: update the specific enrollment status
    await Student.updateOne(
        { _id: studentId, "enrollments.transactionId": transactionId },
        { $set: { "enrollments.$.paymentStatus": "VERIFIED" } }
    );
    
    res.json({ success: true });
};

exports.dispatchFounderReport = async (req, res) => {
    try {
        const { targetMonth, totalRevenue, topCourses, totalStudents, pendingQueue } = req.body;

        // Note: Setup your environment variables for SMTP
        const transporter = nodemailer.createTransport({
            service: 'gmail', // or your preferred SMTP
            auth: {
                user: process.env.EMAIL_USER, 
                pass: process.env.EMAIL_PASS
            }
        });

        // Format the top courses list for the email
        const coursesHtml = topCourses.map((c, i) => 
            `<li><strong>${i + 1}. ${c.courseName}</strong> - Enrolls: ${c.enrollments} | Revenue: ₹${c.revenue.toLocaleString()}</li>`
        ).join('');

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: process.env.FOUNDER_EMAILS, 
            subject: `📊 Expert Academy Monthly Intelligence Report: ${targetMonth}`,
            html: `
                <div style="font-family: Arial, sans-serif; color: #1A5F7A; max-w: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                    <div style="background-color: #F37021; padding: 20px; text-align: center;">
                        <h2 style="color: white; margin: 0; font-style: italic;">EXPERT ACADEMY</h2>
                        <p style="color: rgba(255,255,255,0.8); margin: 5px 0 0; text-transform: uppercase; font-size: 12px; letter-spacing: 2px;">Automated Market Intelligence</p>
                    </div>
                    
                    <div style="padding: 30px;">
                        <h3 style="border-bottom: 2px solid #f1f5f9; padding-bottom: 10px; margin-top: 0;">Period: ${targetMonth}</h3>
                        
                        <div style="display: flex; gap: 20px; margin-bottom: 30px;">
                            <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; flex: 1;">
                                <p style="font-size: 10px; text-transform: uppercase; color: #64748b; margin: 0;">Monthly Revenue</p>
                                <p style="font-size: 24px; font-weight: bold; margin: 5px 0 0;">₹${totalRevenue.toLocaleString()}</p>
                            </div>
                            <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; flex: 1;">
                                <p style="font-size: 10px; text-transform: uppercase; color: #64748b; margin: 0;">Total Students</p>
                                <p style="font-size: 24px; font-weight: bold; margin: 5px 0 0;">${totalStudents}</p>
                            </div>
                        </div>

                        <h4 style="color: #F37021; text-transform: uppercase;">Top Performing Programs</h4>
                        <ul style="line-height: 1.8; color: #334155; background: #f8fafc; padding: 20px 40px; border-radius: 8px;">
                            ${coursesHtml || "<li>No course data generated for this period.</li>"}
                        </ul>
                        
                        <p style="font-size: 12px; color: #94a3b8; margin-top: 30px;">
                            Pending verification queues: <strong>${pendingQueue}</strong>.<br/>
                            Report generated automatically by the Admin Dashboard.
                        </p>
                    </div>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);

        res.status(200).json({ success: true, message: "Report dispatched successfully" });
    } catch (error) {
        console.error("Report Dispatch Error:", error);
        res.status(500).json({ success: false, message: "Failed to dispatch report" });
    }
};