const axios = require('axios');
const Inquiry = require('../models/Inquiry');
const { sendInquiryEmail } = require('../services/mailService');

// 1. VERIFY WEBHOOK (Required for Meta Setup)
exports.verifyWebhook = (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token === process.env.FB_VERIFY_TOKEN) {
        res.status(200).send(challenge);
    } else {
        res.sendStatus(403);
    }
};

// 2. RECEIVE LEAD DATA
exports.handleLeadWebhook = async (req, res) => {
    try {
        const body = req.body;

        if (body.object === 'page') {
            for (const entry of body.entry) {
                for (const change of entry.changes) {
                    if (change.field === 'leadgen') {
                        const leadId = change.value.leadgen_id;
                        await processFacebookLead(leadId);
                    }
                }
            }
        }
        res.status(200).send('EVENT_RECEIVED');
    } catch (err) {
        res.sendStatus(500);
    }
};

// 3. FETCH LEAD DETAILS FROM META API
async function processFacebookLead(leadId) {
    try {
        const response = await axios.get(
            `https://graph.facebook.com/v19.0/${leadId}?access_token=${process.env.FB_PAGE_ACCESS_TOKEN}`
        );

        const { field_data } = response.data;
        
        // Map Facebook form fields to your Inquiry Model
        const leadInfo = {};
        field_data.forEach(item => {
            if (item.name === 'full_name') leadInfo.name = item.values[0];
            if (item.name === 'email') leadInfo.email = item.values[0];
            if (item.name === 'phone_number') leadInfo.phone = item.values[0];
        });

        // Save to your "My Inquiry" section
        const newInquiry = await Inquiry.create({
            name: leadInfo.name || "Meta Prospect",
            email: leadInfo.email || "Not Provided",
            phone: leadInfo.phone,
            course: "Interested via Meta Ads",
            source: 'Facebook', // Strictly tagged for your Admin Dashboard
            leadId: leadId // Prevents duplicates
        });

        await sendInquiryEmail(newInquiry);
        console.log(`Lead from Facebook saved: ${newInquiry.name}`);

    } catch (error) {
        console.error("Meta API Fetch Error:", error.message);
    }
}