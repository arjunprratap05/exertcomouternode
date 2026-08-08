// controllers/aiInteractionController.js
const axios = require('axios');
const Student = require('../models/student');
const AuditLog = require('../models/AuditLog');
const { sendWhatsAppMessage } = require('../services/whatsappService');

// --- INTERNAL AI GENERATOR HELPER ---
async function generateAIResponse(prompt) {
    try {
        const response = await axios.post(
            'https://openrouter.ai/api/v1/chat/completions',
            {
                model: "openrouter/free",
                messages: [
                    { role: "system", content: "You are the automated Social Media Manager for Expert Computer Academy. Keep responses concise, highly professional, encouraging, and free of emojis unless requested. Output raw text only, no markdown." },
                    { role: "user", content: prompt }
                ],
                temperature: 0.3
            },
            { headers: { "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}` } }
        );
        return response.data.choices?.[0]?.message?.content || "";
    } catch (error) {
        console.error("AI Generation Error:", error?.response?.data || error.message);
        return null;
    }
}

// --- 1. META ENGINE (INSTAGRAM & FACEBOOK COMMENTS) ---
exports.processMetaComment = async (payload) => {
    try {
        // Determine platform and extract data
        const isInstagram = payload.object === 'instagram';
        const entry = payload.entry?.[0];
        const changes = entry?.changes?.[0]?.value;
        
        if (!changes || changes.item !== 'comment' || changes.verb !== 'add') return;

        const commentId = changes.id;
        const commentText = changes.text;
        const senderId = changes.from?.id;

        // Ensure we don't reply to the Academy's own comments
        if (senderId === process.env.META_PAGE_ID || senderId === process.env.IG_ACCOUNT_ID) return;

        // Generate the AI Responses
        const publicReply = await generateAIResponse(`A user just commented "${commentText}" on our post. Generate a friendly, 1-sentence public reply acknowledging them and telling them to check their DMs.`);
        const privateDM = await generateAIResponse(`A user commented "${commentText}". Generate a short private direct message introducing Expert Computer Academy, offering to answer questions, and asking for their WhatsApp number for a syllabus link.`);

        if (!publicReply || !privateDM) return;

        const headers = { Authorization: `Bearer ${process.env.FB_PAGE_ACCESS_TOKEN}` };

        // Platform-Specific Execution
        if (isInstagram) {
            // Public Reply to IG Comment
            await axios.post(`https://graph.facebook.com/v19.0/${commentId}/replies`, 
                { message: publicReply }, { headers }
            );

            // Private DM via IG
            await axios.post(`https://graph.facebook.com/v19.0/${process.env.IG_ACCOUNT_ID}/messages`, 
                { recipient: { comment_id: commentId }, message: { text: privateDM } }, { headers }
            );
        } else {
            // Public Reply to FB Comment
            await axios.post(`https://graph.facebook.com/v19.0/${commentId}/comments`, 
                { message: publicReply }, { headers }
            );

            // Private DM via FB Page (Using senderId PSID)
            await axios.post(`https://graph.facebook.com/v19.0/me/messages`, 
                { 
                    recipient: { id: senderId }, 
                    messaging_type: "RESPONSE",
                    message: { text: privateDM } 
                }, 
                { headers }
            );
        }

        await AuditLog.create({ 
            action: `${isInstagram ? 'Instagram' : 'Facebook'} Auto-Reply Sent`, 
            performedBy: "OMNI-AGENT", 
            targetName: changes.from?.username || changes.from?.name || "Social User" 
        });

    } catch (error) {
        console.error("Meta Processing Error:", error?.response?.data || error.message);
    }
};

// --- 2. GOOGLE ENGINE (BUSINESS REVIEWS) ---
exports.processGoogleReview = async (payload) => {
    try {
        // Google Pub/Sub sends data as a base64 encoded string
        const decodedData = Buffer.from(payload.message.data, 'base64').toString('utf-8');
        const event = JSON.parse(decodedData);

        const locationName = event.locationName;
        const reviewName = event.reviewName; 
        const review = event.review;

        if (!review || review.comment === undefined) return;

        // Generate SEO-optimized reply via AI
        const aiPrompt = `A student left a ${review.starRating} star review saying: "${review.comment}". Generate a polite, professional reply from the Director of Expert Computer Academy thanking them. If the review is negative, apologize and ask them to contact the front desk.`;
        const generatedReply = await generateAIResponse(aiPrompt);

        if (!generatedReply) return;

        // Push reply to Google Business Profile API
        await axios.put(`https://mybusiness.googleapis.com/v4/${reviewName}/reply`, 
            { comment: generatedReply },
            { headers: { Authorization: `Bearer ${process.env.GOOGLE_ACCESS_TOKEN}` } }
        );

        await AuditLog.create({ action: "Google Review Replied", performedBy: "OMNI-AGENT", targetName: review.reviewer?.displayName || "Reviewer" });

    } catch (error) {
        console.error("Google Processing Error:", error.message);
    }
};

// --- 3. JUSTDIAL ENGINE (LIVE LEAD TO WHATSAPP) ---
exports.processJustdialLead = async (payload) => {
    try {
        const { name, mobile, email, category } = payload;
        
        if (!mobile) return;

        // Format number to ensure country code
        let formattedPhone = mobile.replace(/[^0-9+]/g, '');
        if (formattedPhone.length === 10) formattedPhone = `+91${formattedPhone}`;

        // Instantly register the lead in the ecosystem
        await Student.create({
            name: name || "Justdial Lead",
            phone: formattedPhone,
            email: email || "",
            leadStatus: "New",
            isAiControlled: true, 
            source: "Justdial"
        });

        // Generate contextual WhatsApp intro
        const introMessage = `Hi ${name || 'there'}! 👋 This is the AI Admissions Desk at Expert Computer Academy. We received your inquiry via Justdial regarding ${category || 'our computer courses'}. How can we assist you today? We can provide batch timings, syllabus PDFs, or fee structures!`;

        // Fire WhatsApp message via existing service
        await sendWhatsAppMessage(formattedPhone, introMessage);

        await AuditLog.create({ action: "Justdial Lead Captured", performedBy: "OMNI-AGENT", targetName: name || formattedPhone });

    } catch (error) {
        console.error("Justdial Processing Error:", error.message);
    }
};