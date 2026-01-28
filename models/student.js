const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
    // Personal & Identity Details
    name: { type: String, required: true },
    fatherName: { type: String, required: true },
    dob: { type: Date, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    aadhaarNo: { type: String, required: true },
    address: { type: String, required: true },
    
    // Academic Records (Required for 38-Year Legacy Records)
    highSchoolBoard: String,
    highSchoolYear: String,
    highSchoolPercent: String,
    interBoard: String,
    interYear: String,
    interPercent: String,

    // Course Track
    course: { type: String, required: true },

    // Financial Management (CRITICAL FOR NEW ADMIN DASHBOARD)
    amountPaid: { type: Number, default: 0 }, // Tracks total installments
    paymentStatus: { type: String, default: 'Pending' }, // Calculated in frontend or updated manually

    // System Details
    enrollmentDate: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.models.Student || mongoose.model('Student', studentSchema);