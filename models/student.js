const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
    name: { type: String, required: true },
    aadhaarNo: { type: String, required: true, unique: true }, 
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true },
    registrationId: { type: String, unique: true },
    password: { type: String },
    isPortalActive: { type: Boolean, default: false }, 
    
    // Authorization Link
    activeBatches: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Batch' 
    }],

    // Enrollment Array
    enrollments: [{
        course: { type: String },
        enrolledAt: { type: Date, default: Date.now },
        status: { type: String, enum: ['Applied', 'Enrolled', 'Completed'], default: 'Applied' },
        courseFee: { type: Number, default: 0 },
        paymentOption: { type: String }, 
        transactionId: { type: String }, 
        paymentStatus: { type: String, enum: ['PENDING', 'VERIFIED', 'REJECTED'], default: 'PENDING' },
        emiMonths: { type: Number, default: 1 }
    }],

    // Legacy Support fields
    course: { type: String }, 
    totalFee: { type: Number, default: 0 }, 
    amountPaid: { type: Number, default: 0 },
    paymentOption: { type: String },
    transactionId: { type: String }, 
    isApproved: { type: Boolean, default: false }
}, { timestamps: true });

studentSchema.index({ "enrollments.transactionId": 1 }, { unique: true, sparse: true });

module.exports = mongoose.models.Student || mongoose.model('Student', studentSchema);