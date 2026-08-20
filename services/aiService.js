// services/aiService.js
const { OpenAI } = require('openai');
const Message = require('../models/Message');
const Student = require('../models/student');
const { sendWhatsAppMessage } = require('./whatsappService');
const courseData = require('../data/course'); 

// 1. Initialize OpenAI SDK pointing to OpenRouter's edge gateway
const openai = new OpenAI({ 
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
    defaultHeaders: {
        'HTTP-Referer': 'https://exertcomouternode.vercel.app', 
        'X-Title': 'ECA Live Agent'
    }
});

// Helper function for Deep ML sentiment and intent analysis
async function analyzeStudentDeepML(messageText, history) {
    try {
        const response = await openai.chat.completions.create({
            model: 'openrouter/free', 
            response_format: { type: "json_object" },
            messages: [
                {
                    role: "system",
                    content: `You are a Deep ML classification engine. Analyze the student's message and history. Return a JSON object with:
                    - "sentiment": "positive", "neutral", or "negative"
                    - "intent": "course_inquiry", "fee_negotiation", "technical_issue", or "general"
                    - "conversionProbability": a number from 0 to 100 representing likelihood to enroll`
                },
                ...history,
                { role: "user", content: messageText }
            ]
        });

        return JSON.parse(response.choices[0].message.content);
    } catch (err) {
        console.error("Deep ML Analysis Error:", err);
        return { sentiment: "neutral", intent: "general", conversionProbability: 50 };
    }
}

exports.processAiResponse = async (studentPhone, messageText) => {
    try {
        const student = await Student.findOne({ phone: studentPhone });
        const history = await Message.find({ phoneNumber: studentPhone }).sort({ timestamp: -1 }).limit(10);
        const formattedHistory = history.reverse().map(msg => ({
            role: msg.sender === 'student' ? 'user' : 'assistant',
            content: msg.text
        }));

        // 1. Run Deep ML analysis on incoming message & history
        const mlInsights = await analyzeStudentDeepML(messageText, formattedHistory);

        // Update student profile with latest ML scoring in MongoDB
        await Student.updateOne(
            { phone: studentPhone },
            { 
                $set: { 
                    sentiment: mlInsights.sentiment, 
                    conversionProbability: mlInsights.conversionProbability 
                } 
            }
        );

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

        // 2. Call OpenRouter for the main agent response
        const completion = await openai.chat.completions.create({
            model: 'openai/gpt-4o', 
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