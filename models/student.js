const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
    name: { type: String, required: true },
    aadhaarNo: { type: String, required: true, unique: true }, 
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true },
    
    registrationId: { type: String, unique: true },
    password: { type: String },

    // --- THE MISSING KEY ---
    // Without this, the grant-access route does nothing
    isPortalActive: { type: Boolean, default: false }, 

    enrollments: [{
        course: { type: String, required: true },
        enrolledAt: { type: Date, default: Date.now },
        status: { type: String, enum: ['Applied', 'Enrolled', 'Completed'], default: 'Applied' },
        activeBatches: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Batch' }]
    }],

    course: { type: String }, 
    activeBatches: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Batch' }],

    totalFee: { type: Number, default: 0 },
    amountPaid: { type: Number, default: 0 },
    isApproved: { type: Boolean, default: false },
    studentImage: { data: Buffer, contentType: String }
}, { timestamps: true });

module.exports = mongoose.model('Student', studentSchema);