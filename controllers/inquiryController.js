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