const express = require('express');
const router = express.Router();
const { processMetaComment, processGoogleReview, processJustdialLead } = require('../controllers/aiInteractionController');

router.post('/social-inbound', async (req, res) => {
    try {
        const body = req.body;
        console.log("Incoming Webhook Payload:", JSON.stringify(body, null, 2));

        if (body.object === 'page') {
            for (const entry of body.entry) {
                if (entry.changes) {
                    for (const change of entry.changes) {
                        // This triggers on ANY comment added to a post
                        if (change.field === 'feed' && change.value.item === 'comment' && change.value.verb === 'add') {
                            const commentText = change.value.message;
                            const commentId = change.value.comment_id;
                            const senderId = change.value.from.id;
                            const senderName = change.value.from.name;

                            // Prevent infinite loops if the Page itself comments
                            if (senderId === process.env.FB_PAGE_ID) continue;

                            console.log(`Captured live comment from ${senderName}: "${commentText}"`);

                            // Send this directly to your AI function to reply & DM
                            await processAiCommentAndDm({
                                commentId,
                                senderId,
                                commentText,
                                senderName
                            });
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