// controllers/globalSearchController.js
const Student = require('../models/student');
const Message = require('../models/Message');
const Enquiry = require('../models/Inquiry');
const Coupon = require('../models/Coupon');
const Batch = require('../models/Batch');

// Helper to decode Indian phone number metadata (State/Circle & Carrier type)
const parsePhoneMetadata = (phone) => {
    const clean = phone.replace(/\D/g, '');
    if (clean.length < 10) return null;
    const num = clean.slice(-10);
    const prefix = num.slice(0, 4);

    // Basic Indian telecom circle mapping based on starting digits
    let region = "India (National)";
    if (prefix.startsWith('9431') || prefix.startsWith('620') || prefix.startsWith('700')) region = "Bihar / Jharkhand";
    else if (prefix.startsWith('9810') || prefix.startsWith('9910') || prefix.startsWith('8800')) region = "Delhi NCR";
    else if (prefix.startsWith('9820') || prefix.startsWith('9819') || prefix.startsWith('9920')) region = "Mumbai, Maharashtra";
    else if (prefix.startsWith('9840') || prefix.startsWith('9940')) region = "Chennai, Tamil Nadu";
    else if (prefix.startsWith('9830') || prefix.startsWith('9831')) region = "Kolkata, West Bengal";
    else if (prefix.startsWith('9880') || prefix.startsWith('9900')) region = "Bangalore, Karnataka";
    else if (prefix.startsWith('9871') || prefix.startsWith('9811')) region = "North India Zone";

    return {
        formattedNumber: `+91 ${num.slice(0, 5)} ${num.slice(5)}`,
        telecomCircle: region,
        lineType: "Mobile (GSM / VoLTE)",
        riskScore: "Low Risk (Verified Format)"
    };
};

exports.globalSearch = async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || q.trim().length === 0) {
            return res.json({ success: true, results: { students: [], enquiries: [], messages: [], coupons: [], batches: [], extractedProfile: null } });
        }

        const searchRegex = new RegExp(q, 'i');

        // 1. Run internal MongoDB searches concurrently
        const [students, enquiries, messages, coupons, batches] = await Promise.all([
            Student.find({ $or: [{ name: searchRegex }, { phone: searchRegex }, { email: searchRegex }] }).limit(3),
            Enquiry.find({ $or: [{ name: searchRegex }, { phone: searchRegex }, { course: searchRegex }] }).limit(3),
            Message.find({ phoneNumber: searchRegex }).sort({ timestamp: -1 }).limit(5),
            Coupon.find({ $or: [{ code: searchRegex }, { description: searchRegex }] }).limit(3),
            Batch.find({ $or: [{ batchCode: searchRegex }, { courseName: searchRegex }, { instructor: searchRegex }] }).limit(3)
        ]);

        // 2. Extract live profile intelligence if query resembles a phone number or name
        let extractedProfile = null;
        const isPhoneQuery = /\d{5,}/.test(q);

        if (isPhoneQuery) {
            const phoneNum = q.replace(/\D/g, '').slice(-10);
            const metadata = parsePhoneMetadata(phoneNum);
            
            // Gather message history count & last active for this phone
            const msgHistory = await Message.find({ phoneNumber: phoneNum }).sort({ timestamp: -1 });
            const linkedStudent = await Student.findOne({ phone: phoneNum });
            const linkedEnquiry = await Enquiry.findOne({ phone: phoneNum });

            extractedProfile = {
                identifier: phoneNum,
                metadata,
                matchedName: linkedStudent?.name || linkedEnquiry?.name || "Unregistered Lead / External Caller",
                totalMessages: msgHistory.length,
                lastMessage: msgHistory[0]?.text || "No direct WhatsApp messages recorded.",
                sentiment: linkedStudent?.sentiment || "Neutral",
                conversionProbability: linkedStudent?.conversionProbability || 50,
                status: linkedStudent ? "Registered Student" : (linkedEnquiry ? "Website Lead" : "Direct WhatsApp Caller")
            };
        }

        res.json({
            success: true,
            results: {
                students,
                enquiries,
                messages,
                coupons,
                batches,
                extractedProfile
            }
        });

    } catch (err) {
        console.error("Global Search Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
};