// models/ChatSession.js
const mongoose = require('mongoose');

const chatSessionSchema = new mongoose.Schema({
    sessionId: { type: String, required: true, unique: true },
    history: [{ role: String, content: String }],
    leadData: {
        name: { type: String, default: null },
        contact: { type: String, default: null },
        course: { type: String, default: null }
    },
    isLeadSaved: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('ChatSession', chatSessionSchema);