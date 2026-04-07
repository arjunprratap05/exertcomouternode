const Inquiry = require('../models/Inquiry');
const { sendInquiryEmail } = require('../services/mailService');

// Ensure this matches 'processNewLead'
exports.processNewLead = async (req, res) => {
    try {
        const { name, email, phone, message, course, source = 'Website' } = req.body;
        
        const newInquiry = new Inquiry({ name, email, phone, course, message, source });
        await newInquiry.save();

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