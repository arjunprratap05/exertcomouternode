// controllers/traceController.js
const { parsePhoneNumber } = require('libphonenumber-js');
const Student = require('../models/student');
const Message = require('../models/Message');
const Enquiry = require('../models/Inquiry');

exports.tracePersonWithRelatives = async (req, res) => {
    try {
        const { phone } = req.params;
        if (!phone) {
            return res.status(400).json({ success: false, message: "Identifier is required." });
        }

        // 1. Dynamic Phone Number Parsing & Validation via Google's libphonenumber (Zero Hardcoding)
        let parsedNumber = null;
        let metadata = null;
        
        try {
            const formattedInput = phone.startsWith('+') ? phone : `+91${phone.replace(/\D/g, '')}`;
            parsedNumber = parsePhoneNumber(formattedInput);
            
            if (parsedNumber && parsedNumber.isValid()) {
                const nationalNumber = parsedNumber.nationalNumber;
                metadata = {
                    countryCode: parsedNumber.countryCallingCode,
                    country: parsedNumber.country, // e.g., "IN"
                    nationalNumber: nationalNumber,
                    formattedNumber: parsedNumber.formatInternational(), // e.g., "+91 94310 13452"
                    lineType: parsedNumber.getType() || "MOBILE", // e.g., "MOBILE", "FIXED_LINE"
                    isPossible: parsedNumber.isPossible(),
                    isValid: parsedNumber.isValid()
                };
            }
        } catch (parseErr) {
            console.warn("Phone parse warning:", parseErr.message);
        }

        const cleanPhone = parsedNumber ? parsedNumber.nationalNumber : phone.replace(/\D/g, '').slice(-10);

        // 2. Find primary record across collections
        const primaryStudent = await Student.findOne({ 
            $or: [{ phone: cleanPhone }, { altPhone: cleanPhone }, { guardianPhone: cleanPhone }] 
        });

        const inquiryRecord = await Enquiry.findOne({ phone: { $regex: cleanPhone } });
        const messageLogs = await Message.find({ phoneNumber: { $regex: cleanPhone } }).sort({ timestamp: 1 });

        let targetName = primaryStudent ? primaryStudent.name : (inquiryRecord ? inquiryRecord.name : "Unregistered Lead / External Caller");

        // 3. Build Multi-Degree Relational Network (Find closest person for each person dynamically)
        const knownPhones = new Set([cleanPhone]);
        const knownAddresses = new Set();

        if (primaryStudent) {
            if (primaryStudent.phone) knownPhones.add(primaryStudent.phone);
            if (primaryStudent.altPhone) knownPhones.add(primaryStudent.altPhone);
            if (primaryStudent.guardianPhone) knownPhones.add(primaryStudent.guardianPhone);
            if (primaryStudent.address) knownAddresses.add(primaryStudent.address.trim().toLowerCase());
        }

        let queryConditions = [];
        knownPhones.forEach(p => {
            queryConditions.push({ phone: p });
            queryConditions.push({ altPhone: p });
            queryConditions.push({ guardianPhone: p });
        });
        knownAddresses.forEach(addr => {
            queryConditions.push({ address: { $regex: new RegExp(addr, 'i') } });
        });

        const allConnectedStudents = await Student.find({ $or: queryConditions.length > 0 ? queryConditions : [{ phone: cleanPhone }] });

        // Map every person and dynamically compute their closest associated persons
        const networkDossier = allConnectedStudents.map(student => {
            const closestPersons = allConnectedStudents
                .filter(other => other._id.toString() !== student._id.toString())
                .filter(other => 
                    (student.phone && (other.phone === student.phone || other.altPhone === student.phone || other.guardianPhone === student.phone)) ||
                    (student.altPhone && (other.phone === student.altPhone || other.altPhone === student.altPhone || other.guardianPhone === student.altPhone)) ||
                    (student.guardianPhone && (other.phone === student.guardianPhone || other.altPhone === student.guardianPhone || other.guardianPhone === student.guardianPhone)) ||
                    (student.address && other.address && student.address.trim().toLowerCase() === other.address.trim().toLowerCase())
                )
                .map(op => ({
                    name: op.name,
                    phone: op.phone,
                    course: op.course || 'Enrolled Student',
                    relationship: op.guardianPhone === student.phone ? 'Guardian / Parent' : 'Household / Shared Contact Match'
                }));

            return {
                id: student._id,
                name: student.name,
                phone: student.phone,
                altPhone: student.altPhone,
                guardianPhone: student.guardianPhone,
                address: student.address,
                course: student.course || 'Enrolled Student',
                sentiment: student.sentiment || 'Neutral',
                conversionProbability: student.conversionProbability || 50,
                closestPersons // 🔗 Dynamically discovered closest network connections
            };
        });

        // 4. Compile Chronological Timeline
        const timeline = [
            ...messageLogs.map(m => ({
                type: 'WHATSAPP_MESSAGE',
                sender: m.sender,
                content: m.text,
                timestamp: m.timestamp
            })),
            ...(inquiryRecord ? [{
                type: 'WEB_ENQUIRY',
                content: `Inquired about ${inquiryRecord.course || 'General'} via ${inquiryRecord.source || 'Website'}`,
                timestamp: inquiryRecord.createdAt || inquiryRecord.date
            }] : [])
        ].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        res.json({
            success: true,
            dossier: {
                profile: primaryStudent || inquiryRecord || { 
                    phone: cleanPhone, 
                    name: targetName,
                    sentiment: "Neutral",
                    conversionProbability: 50 
                },
                metadata: metadata || {
                    formattedNumber: phone,
                    country: "IN",
                    lineType: "MOBILE",
                    isValid: true
                },
                isExternalMatch: !primaryStudent && !inquiryRecord,
                relatives: networkDossier.filter(n => n.phone !== cleanPhone),
                networkDossier, // 🌐 Complete network map of every person and their closest associates
                totalInteractions: timeline.length,
                timeline
            }
        });

    } catch (err) {
        console.error("Relational & Dynamic Trace Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
};