const { techCoursesData, universityPrograms } = require('../data/course');

exports.getBotReply = async (userMsg) => {
    const msg = userMsg.toLowerCase().trim();
    const allCourses = [...techCoursesData, ...universityPrograms];

    // 1. Handover Triggers (Keywords + Affirmative responses)
    const affirmative = ["yes", "yeah", "ok", "okay", "yep", "sure", "connect", "talk", "human", "executive"];
    if (affirmative.some(key => msg === key || msg.includes(key))) {
        return "HANDOVER_TRIGGER";
    }

    // 2. Intelligent Course Matcher
    const matched = allCourses.find(c => 
        msg.includes(c.id.toLowerCase()) || 
        c.title.toLowerCase().split(' ').some(word => word.length > 3 && msg.includes(word))
    );

    if (matched) {
        const fee = Number(matched.fee).toLocaleString('en-IN');
        return `Regarding **${matched.title}**:
        \n• **Exact Fee:** ₹${fee}
        \n• **Curriculum:** ${matched.modules.slice(0, 4).join(", ")}...
        \n\nWould you like me to connect you with our admission counselor for batch timings?`;
    }

    // 3. Fallback logic
    if (msg.includes("price") || msg.includes("fee")) {
        return "Fees range from ₹3,000 to ₹46,500. Which specific course are you interested in? (e.g., ADCA, Tally, Java, or Python)";
    }

    return "I am the Expert AI. I can give you exact fees and syllabus for any course. Which one would you like to know about?";
};

exports.generateSecureLink = (agentId) => {
    const phones = { "counselor_1": process.env.AGENT_1_PHONE, "counselor_2": process.env.AGENT_2_PHONE };
    const target = phones[agentId] || process.env.AGENT_1_PHONE;
    return `https://wa.me/${target}?text=I was just chatting with the Expert AI and I want to enroll in a course.`;
};