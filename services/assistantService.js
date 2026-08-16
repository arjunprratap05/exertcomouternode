const { OpenAI } = require('openai');
const { tavily } = require('@tavily/core');

// Import your course data (adjust path if needed based on your folder structure)
const { techCoursesData, universityPrograms } = require('../data/course'); 

// 1. Initialize OpenRouter
const openai = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY,
});

// 2. Initialize Tavily
const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });

// --- HELPER FUNCTION: Formats your arrays into readable text for the AI ---
const buildKnowledgeBase = () => {
    let kb = "TECH COURSES OFFERED:\n";
    techCoursesData.forEach(course => {
        const durationText = course.duration ? `Duration: ${course.duration}` : 'Duration: Contact for details';
        kb += `- ${course.title} (Fee: ₹${course.fee}, ${durationText})\n  Modules: ${course.modules.join(", ")}\n`;
    });
    
    kb += "\nUNIVERSITY PROGRAMS OFFERED:\n";
    universityPrograms.forEach(prog => {
        const durationText = prog.duration ? `Duration: ${prog.duration}` : 'Duration: Contact for details';
        kb += `- ${prog.title} from ${prog.university} (Fee: ₹${prog.fee}, ${durationText})\n  Target: ${prog.cat}\n`;
    });
    return kb;
};

exports.getBotReply = async (userMessage, session) => {
    try {
        // --- TAVILY SEARCH STEP ---
        let searchContext = "No external search needed.";
        
        if (userMessage.length > 8 && !session.leadData.name && !session.leadData.contact) {
            try {
                const searchResponse = await tvly.search(userMessage, { maxResults: 3 });
                searchContext = searchResponse.results.map(r => r.content).join("\n");
            } catch (tavilyError) {
                console.error("Tavily Search Error:", tavilyError.message);
            }
        }

        const currentLeadState = `
        CURRENT KNOWLEDGE ABOUT USER:
        - Name: ${session.leadData.name || "UNKNOWN"}
        - Contact: ${session.leadData.contact || "UNKNOWN"}
        - Course: ${session.leadData.course || "UNKNOWN"}
        `;

        // --- DYNAMIC GOAL CALCULATION ---
        const missingInfo = [];
        if (!session.leadData.name) missingInfo.push("Name");
        if (!session.leadData.contact) missingInfo.push("WhatsApp Number or Email");
        
        const currentGoal = missingInfo.length > 0 
            ? `GOAL: You MUST ask the user for their ${missingInfo[0]} at the end of your reply.` 
            : `GOAL: You have all their details. Answer their questions and ask if they would like to visit the Patna center for a free demo.`;

        // Generate the live syllabus data
        const ECA_SYLLABUS_AND_FEES = buildKnowledgeBase();

        // --- SYSTEM PROMPT ---
        const SYSTEM_PROMPT = `
        You are the friendly AI Admissions Counselor for Expert Computer Academy (ECA) in Patna.
        Contact: 7282983335.
        
        KNOWLEDGE BASE (ECA Details):
        ${ECA_SYLLABUS_AND_FEES}
        
        LIVE SEARCH CONTEXT (From Web):
        ${searchContext}
        
        YOUR MISSION & CONVERSATIONAL FORMULA:
        Every time you reply, you MUST follow this exact 2-step formula:
        STEP 1: Answer their question directly and accurately using ONLY the Knowledge Base. 
        ANTI-HALLUCINATION RULE: If a user asks for a specific detail (like exact class timings, durations, or start dates) that is NOT explicitly written in the Knowledge Base, DO NOT GUESS. Politely state that you don't have that exact detail and ask them to call 7282983335.
        STEP 2: End your message with a question based on your CURRENT GOAL.
        
        ${currentGoal}
        
        RULES:
        - NEVER ask for information you already have.
        - Be natural and warm. Use smooth transitions like "By the way...", "To send you the syllabus...", or "So I can assist you better..."
        - Keep responses concise. Nobody likes reading huge blocks of text in a chat widget.
        
        OUTPUT FORMAT (Strict JSON):
        {
          "reply": "Your conversational response (Answer + Follow-up Question)",
          "extracted": {
             "name": "Extract name if found, otherwise null",
             "contact": "Extract phone/email if found, otherwise null",
             "course": "Extract course title if mentioned, otherwise null"
          }
        }
        
        ${currentLeadState}
        `;

        const messages = [
            { role: "system", content: SYSTEM_PROMPT },
            ...session.history,
            { role: "user", content: userMessage }
        ];

        // --- OPENROUTER LLM CALL ---
        const completion = await openai.chat.completions.create({
            model: "openai/gpt-4o-mini", // OpenRouter model routing
            messages: messages,
            response_format: { type: "json_object" }, 
            temperature: 0.3, // Keeps the AI factual and strict to your exact fees
        });

        // Parse and return the JSON
        return JSON.parse(completion.choices[0].message.content);

    } catch (error) {
        console.error("LLM Error:", error);
        return { 
            reply: "I am having a slight network issue connecting to the syllabus database. Please call our Patna center at 7282983335.", 
            extracted: null 
        };
    }
};

exports.generateSecureLink = (agentId) => {
    return `https://wa.me/917282983335?text=Hi%20Expert%20Computer%20Academy,%20I%20need%20admission%20help.`;
};