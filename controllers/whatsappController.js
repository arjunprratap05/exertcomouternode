const axios = require('axios');
const Student = require('../models/student');
const Message = require('../models/Message');
const { processAiResponse } = require('../services/aiService');
const Pusher = require('pusher');

// Initialize Pusher (You will get these keys from your free Pusher.com dashboard)
const pusher = new Pusher({
    appId: process.env.PUSHER_APP_ID,
    key: process.env.PUSHER_KEY,
    secret: process.env.PUSHER_SECRET,
    cluster: process.env.PUSHER_CLUSTER,
    useTLS: true
});

exports.verifyWebhook = (req, res) => {
    if (req.query['hub.mode'] && req.query['hub.verify_token'] === process.env.META_VERIFY_TOKEN) {
        return res.status(200).send(req.query['hub.challenge']);
    }
    res.sendStatus(403);
};

exports.handleIncomingMessage = async (req, res) => {
    res.sendStatus(200); // Acknowledge Meta immediately to prevent retry loops

    const value = req.body.entry?.[0]?.changes?.[0]?.value;
    if (!value?.messages) return;

    let rawPhone = value.messages[0].from; 
    
    // Normalize Indian Phone Numbers
    let studentPhone = rawPhone;
    if (rawPhone.startsWith('91') && rawPhone.length === 12) {
        studentPhone = rawPhone.substring(2); 
    }
    
    const messageText = value.messages[0].text?.body;
    if (!messageText) return;

    // 1. Find or Create the student 
    let student = await Student.findOne({ phone: studentPhone });
    
    if (!student) {
        student = await Student.create({ 
            name: "New WhatsApp Lead",
            phone: studentPhone, 
            email: `${studentPhone}@whatsapp.temp`,
            aadhaarNo: `TEMP_${studentPhone}_${Date.now()}`,
            isAiControlled: true,
            leadStatus: 'Cold Lead',
            leadSource: 'WhatsApp'
        });
    } else if (student.leadSource !== 'WhatsApp') {
        await Student.updateOne(
            { _id: student._id }, 
            { leadSource: 'WhatsApp' }
        );
    }

    // 2. Save message to history
    const newMessage = await Message.create({ 
        phoneNumber: studentPhone,
        sender: 'student', 
        text: messageText,
        timestamp: new Date()
    });

    // 3. PUSHER REAL-TIME EMIT (Pushes to the React Dashboard instantly)
    pusher.trigger("eca-chat-channel", "live_whatsapp_message", newMessage);

    // 4. Intelligent Routing
    const currentHour = new Date().getHours();
    const isBusinessHours = currentHour >= 9 && currentHour < 18; 

    if (isBusinessHours) {
        console.log(`Human intervention required for: ${studentPhone}`);
    } else if (student.isAiControlled) {
        await processAiResponse(studentPhone, messageText);
    }
};

// --- ADMIN DASHBOARD FUNCTIONS ---

exports.getMessages = async (req, res) => {
    try {
        const messages = await Message.find({ phoneNumber: req.params.phone }).sort({ timestamp: 1 });
        res.json({ success: true, messages });
    } catch (err) {
        console.error("Error fetching messages:", err);
        res.status(500).json({ success: false, message: "Failed to fetch messages" });
    }
};

exports.sendManualMessage = async (req, res) => {
    try {
        const { phone, text } = req.body; 
        
        // 1. Connect to Meta API to send the message
        await axios.post(
            `https://graph.facebook.com/v18.0/${process.env.META_PHONE_ID}/messages`,
            {
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: phone.length === 10 ? `91${phone}` : phone, 
                type: "text",
                text: { preview_url: false, body: text }
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.META_ACCESS_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        // 2. Save the admin's message to the database
        const newMessage = await Message.create({ 
            phoneNumber: phone, 
            sender: 'agent', 
            text: text,
            agentNumber: process.env.AGENT_1_PHONE,
            timestamp: new Date()
        });

        // 3. PUSHER REAL-TIME EMIT (Syncs all admin screens instantly)
        pusher.trigger("eca-chat-channel", "live_whatsapp_message", newMessage);

        res.json({ success: true, message: newMessage });
    } catch (err) {
        console.error("Meta API Connection Error:", err.response?.data || err.message);
        res.status(500).json({ 
            success: false, 
            message: "Failed to connect to Meta API." 
        });
    }
};

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