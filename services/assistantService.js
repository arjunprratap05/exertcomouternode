const { GoogleGenAI } = require('@google/genai');

// Initialize Gemini with your free API key
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Define tools/functions the AI can call to fetch exact database information
const academyTools = [{
    functionDeclarations: [
        {
            name: 'get_academy_courses',
            description: 'Get a list of available tech and university programs offered at Expert Computer Academy.',
            parameters: { type: 'OBJECT', properties: {} }
        },
        {
            name: 'capture_lead_details',
            description: 'Save or update the user name, contact details (phone or email), and course interest once provided.',
            parameters: {
                type: 'OBJECT',
                properties: {
                    name: { type: 'STRING', description: 'The name of the user' },
                    contact: { type: 'STRING', description: 'Phone number or email address' },
                    course: { type: 'STRING', description: 'Target course or program discussed' }
                },
                required: ['name', 'contact']
            }
        }
    ]
}];

// Execute local backend functions when Gemini requests tool usage
async function executeToolCall(name, args) {
    if (name === 'get_academy_courses') {
        return JSON.stringify({
            techCourses: ["Full Stack Web Development", "Python & Data Science", "Digital Marketing", "Java & Spring Boot"],
            universityPrograms: ["BCA", "MCA", "B.Sc IT", "PGDCA"]
        });
    }
    if (name === 'capture_lead_details') {
        return JSON.stringify({ status: "success", message: "Lead data noted successfully." });
    }
    return JSON.stringify({ error: "Tool not found." });
}

exports.getBotReply = async (message, session) => {
    try {
        // 1. Construct chat history format for Gemini
        const formattedHistory = session.history.map(h => ({
            role: h.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: h.content }]
        }));

        // 2. Initialize the chat session with the friendly system instructions
        const chatSessionInstance = ai.chats.create({
            model: 'gemini-3.6-flash',
            history: formattedHistory,
            config: {
                systemInstruction: `You are the professional and friendly AI Admissions Desk for Expert Computer Academy in Patna. 
                Your goals are:
                1. Answer questions about courses politely and concisely.
                2. Naturally collect the user's Name, Phone Number, and Course of Interest.
                3. If the user provides their name but not their contact number, kindly ask for it (e.g., "Nice to meet you, [Name]! Could you share your WhatsApp number or email so our senior counselor can send you the course syllabus?").
                4. Never be pushy, but always guide the conversation toward booking a free counseling session or capturing their contact info.`,
                tools: academyTools
            }
        });

        // 3. FIXED: Wrap the user message in the required { message } object
        let response = await chatSessionInstance.sendMessage({ message: message });

        let extractedData = {};

        // 4. Check if Gemini wants to invoke a tool (e.g., getting courses or saving lead)
        if (response.functionCalls && response.functionCalls.length > 0) {
            const call = response.functionCalls[0];
            const toolResultString = await executeToolCall(call.name, call.args);
            const toolResultJson = JSON.parse(toolResultString);

            if (call.name === 'capture_lead_details') {
                extractedData = call.args; // Passes name, contact, course back to controller
            }

            // 5. FIXED: Wrap the tool response in the required { message } object array
            const finalResponse = await chatSessionInstance.sendMessage({
                message: [{
                    functionResponse: {
                        name: call.name,
                        response: toolResultJson
                    }
                }]
            });

            return {
                reply: finalResponse.text,
                extracted: extractedData
            };
        }

        // 6. Basic heuristic fallback extraction if user types info naturally
        if (message.includes("@") || /\d{10}/.test(message)) {
            extractedData.contact = message.trim();
        }

        return {
            reply: response.text,
            extracted: extractedData
        };

    } catch (error) {
        console.error("Gemini Service Error:", error);
        return {
            reply: "I'm having a brief connection pause. Please feel free to call our Patna center at 7282983335!",
            extracted: null
        };
    }
};

exports.generateSecureLink = (agentId) => {
    const phoneNumber = "917282983335"; 
    const text = encodeURIComponent("Hello Expert Computer Academy, I would like to connect with a senior admission counselor.");
    return `https://wa.me/${phoneNumber}?text=${text}`;
};