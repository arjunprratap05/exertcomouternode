// services/aiService.js
const { OpenAI } = require('openai');
const Message = require('../models/Message');
const Student = require('../models/student');
const { sendWhatsAppMessage } = require('./whatsappService');
const courseData = require('../data/course'); 

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

exports.processAiResponse = async (studentPhone, messageText) => {
    try {
        const student = await Student.findOne({ phone: studentPhone });
        const history = await Message.find({ phoneNumber: studentPhone }).sort({ timestamp: -1 }).limit(10);
        const formattedHistory = history.reverse().map(msg => ({
            role: msg.sender === 'student' ? 'user' : 'assistant',
            content: msg.text
        }));

        // Format Tech Courses for AI
        const techString = courseData.techCoursesData.map(c => 
            `- ${c.title}: ₹${c.fee} (Modules: ${c.modules.slice(0,2).join(', ')}...)`
        ).join('\n');

        // Format University Programs for AI
        const uniString = courseData.universityPrograms.map(u => 
            `- ${u.title} at ${u.university}: ₹${u.fee} (For: ${u.cat})`
        ).join('\n');

        const systemPrompt = `You are the official admissions assistant for Expert Computer Academy. 
        Use the following LIVE course data to answer student inquiries accurately. 
        All fees are in INR (₹).

        [TECHNICAL COURSES]
        ${techString}

        [UNIVERSITY PROGRAMS]
        ${uniString}

        YOUR RULES:
        1. Only quote prices and courses from the lists above.
        2. If a student asks about a course not listed, say you will have a counselor check the full catalog tomorrow morning.
        3. If they give their name, end your reply with exactly: |||{"update": {"name": "[Name]", "leadStatus": "Warm Lead"}}|||
        4. If they seem frustrated or have an urgent issue, end your reply with exactly: |||{"update": {"leadStatus": "Urgent Support Needed"}}|||
        
        Keep answers short, friendly, and formatted nicely for WhatsApp.`;

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [{ role: 'system', content: systemPrompt }, ...formattedHistory]
        });

        const aiReply = completion.choices[0].message.content;
        
        // Parse for secret JSON command (Extract Name / Urgency)
        const commandRegex = /\|\|\|(.*?)\|\|\|/;
        const match = aiReply.match(commandRegex);
        let finalMessage = aiReply;

        if (match) {
            try {
                const command = JSON.parse(match[1]);
                if (command.update) {
                    await Student.findOneAndUpdate({ phone: studentPhone }, { $set: command.update });
                }
                finalMessage = aiReply.replace(commandRegex, '').trim();
            } catch (err) {
                console.error("AI Command parse error:", err);
            }
        }

        await Message.create({ phoneNumber: studentPhone, sender: 'bot', text: finalMessage });
        await sendWhatsAppMessage(studentPhone, finalMessage);

    } catch (error) {
        console.error('AI Processing Error:', error);
    }
};