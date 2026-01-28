const mongoose = require('mongoose');

const inquirySchema = new mongoose.Schema({
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, required: true },
    course: { type: String, required: true },
    message: { type: String },
    isContacted: { type: Boolean, default: false }, // "Handled" status
    remarks: { type: String, default: "" } // Admin response notes
}, { timestamps: true });

module.exports = mongoose.models.Inquiry || mongoose.model('Inquiry', inquirySchema);