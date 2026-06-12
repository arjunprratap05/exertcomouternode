const Inquiry = require('../models/Inquiry');
const { sendInquiryEmail } = require('../services/mailService');

// Ensure this matches 'processNewLead'
exports.processNewLead = async (req, res) => {
    try {
        const { name, email, phone, message, course, source = 'Website' } = req.body;
        
        // --- 1. SMART DUPLICATE CHECK ---
        // We dynamically build the query so we don't accidentally block multiple 
        // chatbot leads who might share the default "Not Provided" email state.
        const duplicateQuery = [{ phone: phone }];
        
        if (email && email.trim() !== "" && email !== "Not Provided") {
            duplicateQuery.push({ email: email.toLowerCase().trim() });
        }

        // Check the database for any matching phone OR valid email
        const existingInquiry = await Inquiry.findOne({ $or: duplicateQuery });

        if (existingInquiry) {
            // Return 409 Conflict so the frontend knows exactly why it was rejected
            return res.status(409).json({ 
                success: false, 
                message: "An inquiry with this phone number or email already exists in our system. Our team will contact you shortly!" 
            });
        }
        // --------------------------------

        // 2. SAVE NEW LEAD
        const newInquiry = new Inquiry({ 
            name, 
            email: email ? email.toLowerCase().trim() : "Not Provided", 
            phone, 
            course, 
            message, 
            source 
        });
        
        await newInquiry.save();

        // 3. TRIGGER MAIL NOTIFICATION
        try {
            await sendInquiryEmail(newInquiry);
        } catch (mailErr) {
            console.warn("Mail failed, but lead saved.");
        }
        
        res.status(200).json({ success: true, message: "Inquiry captured successfully." });
    } catch (error) {
        console.error("Controller Error:", error.message);
        res.status(500).json({ success: false, message: "Server error." });
    }
};

exports.updateEnquiry = async (req, res) => {
    try {
        const { id } = req.params;
        const { isContacted, remarks, auditAction, targetName } = req.body;

        const updatedInquiry = await Inquiry.findByIdAndUpdate(
            id,
            { isContacted, remarks },
            { new: true }
        );

        if (!updatedInquiry) {
            return res.status(404).json({ success: false, message: "Lead not found" });
        }

        res.status(200).json({ success: true, data: updatedInquiry });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};