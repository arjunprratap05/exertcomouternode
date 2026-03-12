const { techCoursesData, universityPrograms } = require('../data/course');
const Inquiry = require('../models/Inquiry'); 
const { sendInquiryEmail } = require('../services/mailService');

exports.getBotReply = async (userMsg, sessionData = {}) => {
    const msg = userMsg.trim(); // Keep case for Name
    const msgLower = msg.toLowerCase();
    const allCourses = [...techCoursesData, ...universityPrograms];
    
    // --- 1. LEAD COLLECTION STATE MACHINE ---
    
    // STEP 3: Handle Phone (The final step)
    const phoneRegex = /[6-9]\d{9}/; 
    if (phoneRegex.test(msg) && sessionData.collectingLead && sessionData.tempEmail) {
        const capturedPhone = msg.match(phoneRegex)[0];
        try {
            const newLead = await Inquiry.create({
                name: sessionData.tempName || "AI Lead",
                email: sessionData.tempEmail,
                phone: capturedPhone,
                course: sessionData.lastInteractedCourse || "General Inquiry",
                source: "AI Chatbot"
            });
            
            await sendInquiryEmail(newLead);
            
            const finalName = sessionData.tempName;
            // CLEAN SESSION
            delete sessionData.collectingLead;
            delete sessionData.tempName;
            delete sessionData.tempEmail;

            return `Done, ${finalName}! 🎓 I've synced your profile with our counselor. They will call you on ${capturedPhone} shortly and send the syllabus to ${newLead.email}.`;
        } catch (err) { 
            return "Details noted! Our counselor will reach out to you on this number shortly."; 
        }
    }

    // STEP 2: Handle Email (With strict validation)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (sessionData.collectingLead && sessionData.tempName && !sessionData.tempEmail) {
        if (emailRegex.test(msgLower)) {
            sessionData.tempEmail = msgLower;
            return "Excellent. Finally, what is your **10-digit Mobile Number**? (Required to verify your ID for the lab demo).";
        } else {
            return "That doesn't look like a valid email. Please enter a proper **Email ID** (e.g., name@example.com) so I can send you the course details.";
        }
    }

    // STEP 1: Handle Name
    if (sessionData.collectingLead && !sessionData.tempName) {
        // Validation: Name should be at least 2 words or 3 characters
        if (msg.length < 3) return "Please provide your **Full Name** to continue.";
        
        sessionData.tempName = msg;
        return `Nice to meet you, ${msg}! 📧 What is your **Email Address**? (I'll send the syllabus and fee structure there)`;
    }

    // --- 2. TRIGGERS & HANDOVER ---

    // Handover Initiation
    if (["yes", "yeah", "talk to human", "executive", "whatsapp", "call", "counselor", "connect"].some(key => msgLower.includes(key))) {
        sessionData.collectingLead = true;
        return "I'd be happy to connect you! First, what is your **Full Name**?";
    }

    // --- 3. KNOWLEDGE BASE & COURSE MATCHING ---

    // Location
    if (msgLower.includes("where") || msgLower.includes("location") || msgLower.includes("address") || msgLower.includes("patna")) {
        return "Expert Computer Academy is located near Alpana Market, Patliputra, Patna. We have been the city's legacy IT training center since 1987. \n\n📍 Would you like to know our lab timings or specific course details?";
    }

    // Course Matching
    const matched = allCourses.find(c => 
        msgLower.includes(c.id.toLowerCase()) || 
        c.title.toLowerCase().split(' ').some(word => word.length > 3 && msgLower.includes(word))
    );

    if (matched) {
        sessionData.lastInteractedCourse = matched.title; 
        const fee = Number(matched.fee).toLocaleString('en-IN');
        return `Expert AI: The **${matched.title}** program is a great choice! \n💰 **Fee:** ₹${fee} \n\nWould you like me to connect you with our counselor for batch timings?`;
    }

    // Fallback
    return "I am the Expert Academy AI Counselor. I can assist with syllabus, fees, and career paths. Which course are you interested in today? (e.g. ADCA, Java, Python, or BCA)";
};