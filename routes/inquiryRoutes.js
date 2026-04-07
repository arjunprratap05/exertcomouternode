const express = require('express');
const router = express.Router();
// IMPORTANT: You were missing this line or had a typo here:
const inquiryController = require('../controllers/inquiryController');
const fbController = require('../controllers/facebookController');
// Now inquiryController is defined and can be used here
router.post('/submit', inquiryController.processNewLead);
router.get('/fb-webhook', fbController.verifyWebhook);
router.post('/fb-webhook', fbController.handleLeadWebhook);

router.patch('/:id', inquiryController.updateEnquiry);

module.exports = router;