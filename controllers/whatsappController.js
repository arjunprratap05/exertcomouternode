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

    // 1. Find or create lead (Ensuring it links to the dashboard)
    let student = await Student.findOne({ phone: studentPhone });
    if (!student) {
        student = await Student.create({ 
            name: "New WhatsApp Lead",
            phone: studentPhone, 
            email: `${studentPhone}@whatsapp.temp`,
            aadhaarNo: `TEMP_${studentPhone}_${Date.now()}`,
            isAiControlled: true,
            leadStatus: 'Cold Lead',
            leadSource: 'WhatsApp' // <--- CRITICAL FIX: This makes it show up in the dashboard route
        });
    }

    // 2. Save message to history (Stores entire chat for registration contact)
    await Message.create({ 
        phoneNumber: studentPhone, 
        sender: 'student', 
        text: messageText 
    });

    // 3. Intelligent Routing
    const currentHour = new Date().getHours();
    // 9 AM to 6 PM (09:00 - 17:59)
    const isBusinessHours = currentHour >= 9 && currentHour < 18;

    if (isBusinessHours) {
        // Human is in the office
        console.log(`Human intervention required for: ${studentPhone}`);
        await Student.updateOne({ phone: studentPhone }, { leadStatus: 'Warm Lead' });
    } else if (student.isAiControlled) {
        // After hours + AI is turned on
        await processAiResponse(studentPhone, messageText);
    }
};

exports.getMessages = async (req, res) => {
    try {
        const messages = await Message.find({ phoneNumber: req.params.phone }).sort({ createdAt: 1 });
        res.json({ success: true, messages });
    } catch (err) {
        console.error("Error fetching messages:", err);
        res.status(500).json({ success: false, message: "Failed to fetch messages" });
    }
};

// Send a manual reply from the admin dashboard
exports.sendManualMessage = async (req, res) => {
    try {
        const { phone, text } = req.body;
        
        // 1. Save the admin's message to the database immediately
        const newMessage = await Message.create({ 
            phoneNumber: phone, 
            sender: 'admin', 
            text: text 
        });

        // 2. Add your Meta API call here later to actually send the message to their WhatsApp!
        // await axios.post('https://graph.facebook.com/v17.0/...', { ... })

        res.json({ success: true, message: newMessage });
    } catch (err) {
        console.error("Error sending manual message:", err);
        res.status(500).json({ success: false, message: "Failed to send message" });
    }
};

// Toggle whether the AI or a Human is handling the chat
exports.toggleAi = async (req, res) => {
    try {
        const { isAiControlled } = req.body;
        const student = await Student.findByIdAndUpdate(
            req.params.id, 
            { isAiControlled: isAiControlled },
            { new: true }
        );
        res.json({ success: true, student });
    } catch (err) {
        console.error("Error toggling AI:", err);
        res.status(500).json({ success: false, message: "Failed to toggle AI" });
    }
};