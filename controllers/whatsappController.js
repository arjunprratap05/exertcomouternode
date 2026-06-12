const Student = require('../models/student');
const Message = require('../models/Message');
const { processAiResponse } = require('../services/aiService');

exports.verifyWebhook = (req, res) => {
    if (req.query['hub.mode'] && req.query['hub.verify_token'] === process.env.META_VERIFY_TOKEN) {
        return res.status(200).send(req.query['hub.challenge']);
    }
    res.sendStatus(403);
};

exports.handleIncomingMessage = async (req, res) => {
    res.sendStatus(200); // Acknowledge Meta immediately

    const value = req.body.entry?.[0]?.changes?.[0]?.value;
    if (!value?.messages) return;

    const studentPhone = value.messages[0].from;
    const messageText = value.messages[0].text?.body;
    if (!messageText) return;

    // 1. Find or create lead (using placeholders to satisfy schema requirements)
    let student = await Student.findOne({ phone: studentPhone });
    if (!student) {
        student = await Student.create({ 
            name: "New WhatsApp Lead",
            phone: studentPhone, 
            email: `${studentPhone}@whatsapp.temp`,
            aadhaarNo: `TEMP_${studentPhone}_${Date.now()}`,
            isAiControlled: true,
            leadStatus: 'Cold Lead'
        });
    }

    // 2. Save message to history
    await Message.create({ phoneNumber: studentPhone, sender: 'student', text: messageText });

    // 3. Intelligent Routing
    const currentHour = new Date().getHours();
    // 9 AM to 6 PM (09:00 - 17:59)
    const isBusinessHours = currentHour >= 9 && currentHour < 18;

    if (isBusinessHours) {
        // OPTION: Notify your team here (e.g., send a push notification or dashboard alert)
        console.log(`Human intervention required for: ${studentPhone}`);
        // You could also update leadStatus here to 'Warm Lead' automatically
        await Student.updateOne({ phone: studentPhone }, { leadStatus: 'Warm Lead' });
    } else if (student.isAiControlled) {
        // Only trigger AI if human staff is unavailable
        await processAiResponse(studentPhone, messageText);
    }
};