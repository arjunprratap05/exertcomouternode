const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
    // --- IDENTITY ANCHOR (Unique per person) ---
    name: { type: String, required: true },
    aadhaarNo: { type: String, required: true, unique: true }, 
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true },
    
    // --- SHARED CREDENTIALS ---
    registrationId: { type: String, unique: true },
    password: { type: String },

    // --- PROD MULTI-ENROLLMENT STORAGE ---
    enrollments: [{
        course: { type: String, required: true },
        enrolledAt: { type: Date, default: Date.now },
        status: { type: String, enum: ['Applied', 'Enrolled', 'Completed'], default: 'Applied' },
        activeBatches: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Batch' }]
    }],

    // Helper fields for Dashboard Sync (Most recent session)
    course: { type: String }, 
    activeBatches: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Batch' }],

    totalFee: { type: Number, default: 0 },
    amountPaid: { type: Number, default: 0 },
    isApproved: { type: Boolean, default: false },
    studentImage: { data: Buffer, contentType: String }
}, { timestamps: true });

studentSchema.pre('save', function() {
    if (this.amountPaid === 0) this.paymentStatus = 'Pending';
    else if (this.amountPaid < this.totalFee) this.paymentStatus = 'Partial';
    else this.paymentStatus = 'Paid';
});

module.exports = mongoose.model('Student', studentSchema);