const Inquiry = require('../models/Inquiry');
const { sendInquiryEmail } = require('../services/mailService');

exports.submitInquiry = async (req, res) => {
    try {
        const { name, email, phone, message, course } = req.body;
        
        // 1. Save to MongoDB first
        const newInquiry = new Inquiry({ name, email, phone, course, message });
        await newInquiry.save();

        // 2. Attempt Email (wrapped so saving doesn't fail if email does)
        try {
            await sendInquiryEmail({ name, email, phone, message, course });
        } catch (mailErr) {
            console.warn("Mail failed, but data was saved:", mailErr.message);
        }
        
        res.status(200).json({ success: true, message: "Inquiry received. We will contact you shortly." });
    } catch (error) {
        console.error("CRITICAL SUBMISSION ERROR:", error.message);
        res.status(500).json({ success: false, message: "Server encountered a database error." });
    }
};