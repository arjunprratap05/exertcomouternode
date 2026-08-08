// routes/webhookRoutes.js
const express = require('express');
const router = express.Router();
const { processMetaComment, processGoogleReview, processJustdialLead } = require('../controllers/aiInteractionController');

router.post('/social-inbound', async (req, res) => {
    try {
        const body = req.body;
        console.log("Incoming Webhook Payload:", JSON.stringify(body, null, 2));

        if (body.object === 'page' || body.object === 'instagram') {
            for (const entry of body.entry) {
                // Check for standard Page/Instagram Comments & Feed Changes
                if (entry.changes) {
                    for (const change of entry.changes) {
                        if (change.field === 'feed' && change.value.item === 'comment' && change.value.verb === 'add') {
                            await processMetaComment(body);
                        }
                    }
                }
                // Check for direct Messenger / Instagram messages if subscribed
                if (entry.messaging) {
                    for (const messagingEvent of entry.messaging) {
                        if (messagingEvent.message && !messagingEvent.message.is_echo) {
                            // Map direct messages into a compatible format for your handler if needed
                            await processMetaComment(body);
                        }
                    }
                }
            }
        }
        res.status(200).send('EVENT_RECEIVED');
    } catch (error) {
        console.error("Webhook Error:", error);
        res.status(500).send('Server Error');
    }
});

// GET route for Meta Webhook Verification
router.get('/social-inbound', (req, res) => {
    const verify_token = process.env.META_VERIFY_TOKEN;
    let mode = req.query['hub.mode'];
    let token = req.query['hub.verify_token'];
    let challenge = req.query['hub.challenge'];
    if (mode && token && mode === 'subscribe' && token === verify_token) {
        res.status(200).send(challenge);
    } else {
        res.sendStatus(403);
    }
});

module.exports = router;