const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
    name: { type: String, required: true },
    aadhaarNo: { type: String, required: true, unique: true }, 
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true },
    registrationId: { type: String, unique: true },
    password: { type: String },
    isPortalActive: { type: Boolean, default: false }, 
    enrollments: [{
        course: { type: String, required: true },
        enrolledAt: { type: Date, default: Date.now },
        status: { type: String, enum: ['Applied', 'Enrolled', 'Completed'], default: 'Applied' }
    }],
    course: { type: String }, 
    activeBatches: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Batch' }],
    
    // --- FINANCIAL LEDGER ---
    totalFee: { type: Number, default: 0 }, 
    amountPaid: { type: Number, default: 0 },
    paymentOption: { type: String, enum: ['FULL', 'PARTIAL', 'CASH'], required: true },
    transactionId: { type: String, unique: true, required: true },
    paymentStatus: { type: String, enum: ['PENDING', 'VERIFIED', 'REJECTED'], default: 'PENDING' },
    emiMonths: { type: Number, default: 1 },

    appliedCoupon: {
        code: { type: String },
        discountValue: { type: Number }
    },
    isApproved: { type: Boolean, default: false },
    studentImage: { data: Buffer, contentType: String }
}, { timestamps: true });

module.exports = mongoose.models.Student || mongoose.model('Student', studentSchema);