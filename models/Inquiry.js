const mongoose = require('mongoose');

const inquirySchema = new mongoose.Schema({
    name: { type: String, default: "Prospect" }, 
    phone: { type: String, required: true },
    email: { type: String, default: "Not Provided" }, 
    course: { type: String, default: "General Inquiry" },
    message: { type: String, default: "" },
    // MULTI-SOURCE TRACKING
    source: { 
        type: String, 
        required: true, 
        enum: ['Website', 'AI Chatbot', 'Facebook', 'Instagram', 'Google', 'Manual'],
        default: 'Website' 
    },
    leadId: { type: String }, // Prevents duplicate social media leads
    isContacted: { type: Boolean, default: false },
    remarks: { type: String, default: "" }
}, { timestamps: true });

module.exports = mongoose.models.Inquiry || mongoose.model('Inquiry', inquirySchema);