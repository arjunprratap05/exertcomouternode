const axios = require('axios');

exports.sendWhatsAppMessage = async (toPhoneNumber, messageBody) => {
    try {
        const url = `https://graph.facebook.com/v21.0/${process.env.META_PHONE_NUMBER_ID}/messages`;
        await axios.post(url, {
            messaging_product: 'whatsapp',
            to: toPhoneNumber,
            type: 'text',
            text: { body: messageBody }
        }, {
            headers: { 
                'Authorization': `Bearer ${process.env.META_ACCESS_TOKEN}`
            }
        });
    } catch (error) {
        console.error('WhatsApp API Error:', error.response?.data || error.message);
    }
};