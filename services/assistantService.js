exports.getBotReply = async (userMsg) => {
    const msg = userMsg.toLowerCase();

    if (msg.includes("adca")) {
        return "ADCA is a 6-month diploma covering MS Office, Tally Prime, and C++. No prior coding knowledge is required. Should I connect you with an executive for a detailed discussion?";
    }
    if (msg.includes("tally")) {
        return "We offer Tally Essential (Levels 1-3) with 100% placement assistance. We are an empanelled partner with 38 years of experience in Patna. Talk to a counselor?";
    }
    if (msg.includes("excel")) {
        return "Advanced Excel is a 3-month course focusing on business automation and pivot tables. Connect with an executive now?";
    }
    if (msg.includes("talk") || msg.includes("discussion") || msg.includes("executive")) {
        return "HANDOVER_TRIGGER";
    }

    return "I am the Expert Academy AI. I can help with info on ADCA, Tally, or Python. To talk to a human, type 'Talk to Executive'.";
};

exports.generateSecureLink = (agentId) => {
    const phoneMap = {
        "counselor_1": process.env.AGENT_1_PHONE,
        "counselor_2": process.env.AGENT_2_PHONE
    };
    const target = phoneMap[agentId] || process.env.AGENT_1_PHONE;
    return `https://wa.me/${target}?text=I need a detailed course discussion.`;
};