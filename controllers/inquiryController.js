const Inquiry = require('../models/Inquiry');
const { sendInquiryEmail } = require('../services/mailService');

exports.submitInquiry = async (req, res) => {
    try {
        const { name, email, phone, message, course } = req.body;
        
        // 1. Save to MongoDB
        const newInquiry = new Inquiry({ name, email, phone, course, message });
        await newInquiry.save();

        // 2. Shoot Email Notification
        await sendInquiryEmail({ name, email, phone, message, course });
        
        res.status(200).json({ success: true, message: "Inquiry stored and email sent" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};