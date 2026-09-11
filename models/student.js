const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
    name: { type: String, required: true },
    aadhaarNo: { type: String, required: true, unique: true }, 
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true, unique: true }, 
    registrationId: { type: String, unique: true },
    password: { type: String },
    isPortalActive: { type: Boolean, default: false }, 
    
    activeBatches: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Batch' 
    }],

    // --- NEW WORKING STYLE (NESTED SUB-DOCUMENTS) ---
    enrollments: [{
        course: { type: String },
        enrolledAt: { type: Date, default: Date.now },
        status: { type: String, enum: ['Applied', 'Enrolled', 'Completed'], default: 'Applied' },
        courseFee: { type: Number, default: 0 },   
        amountPaid: { type: Number, default: 0 },  
        paymentOption: { type: String }, 
        transactionId: { type: String }, 
        paymentStatus: { 
            type: String, 
            enum: ['PENDING', 'PARTIALLY_PAID', 'PAID', 'VERIFIED', 'REJECTED'], 
            default: 'PENDING' 
        },
        emiMonths: { type: Number, default: 1 },
        
        // --- COURSE-LEVEL COMPLETION & CERTIFICATE DATA ---
        curriculumProgress: { type: Number, default: 0 }, // 0 to 100%
        examPassed: { type: Boolean, default: false },
        examScore: { type: Number, default: 0 },
        certificateRequest: {
            status: { 
                type: String, 
                enum: ['NONE', 'PENDING', 'APPROVED', 'REJECTED'], 
                default: 'NONE' 
            },
            requestedAt: { type: Date },
            reviewedAt: { type: Date },
            reviewedBy: { type: String },
            certificateFile: { type: Buffer },
            certificateMimeType: { type: String },
            remarks: { type: String }
        }
    }],

    // --- PREVIOUS WORKING STYLE (LEGACY FLAT ROOT FIELDS) ---
    course: { type: String },
    totalFee: { type: Number, default: 0 },
    amountPaid: { type: Number, default: 0 },
    paymentOption: { type: String },
    transactionId: { type: String },
    isApproved: { type: Boolean, default: false },

    // Legacy Fallback Completion & Certificate Fields
    courseCompleted: { type: Boolean, default: false },
    curriculumProgress: { type: Number, default: 0 },
    examPassed: { type: Boolean, default: false },
    examScore: { type: Number, default: 0 },
    certificateRequest: {
        status: { 
            type: String, 
            enum: ['NONE', 'PENDING', 'APPROVED', 'REJECTED'], 
            default: 'NONE' 
        },
        requestedAt: { type: Date },
        reviewedAt: { type: Date },
        reviewedBy: { type: String },
        certificateFile: { type: Buffer },
        certificateMimeType: { type: String },
        remarks: { type: String }
    },

    // --- WHATSAPP LEAD FIELDS ---
    isAiControlled: { type: Boolean, default: true },
    leadStatus: { type: String, enum: ['Cold Lead', 'Warm Lead', 'Hot Lead', 'Applicant', 'Enrolled'], default: 'Cold Lead' },
    leadSource: { type: String, default: 'WhatsApp' }

}, { timestamps: true });

studentSchema.index({ "enrollments.transactionId": 1 }, { unique: true, sparse: true });

module.exports = mongoose.models.Student || mongoose.model('Student', studentSchema);