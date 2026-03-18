const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
    // Step 1: Basics (Identity & Validity)
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    description: { type: String, required: true },
    validFrom: { type: Date, required: true },
    validTo: { type: Date, required: true },
    type: { type: String, enum: ['PROMOTIONAL', 'REFERRAL'], default: 'PROMOTIONAL' },
    maxUsage: { type: Number, required: true },
    usedCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },

    // Step 2: Mapping (Targeting & Math)
    courseCode: { type: String, required: true }, 
    paymentType: { type: String, enum: ['LUMPSUM', 'INSTALLMENT', 'ALL'], default: 'ALL' },
    discountType: { type: String, enum: ['PERCENTAGE', 'FIXED'], default: 'PERCENTAGE' },
    discountValue: { type: Number, required: true },
    isVisibleOnForm: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Coupon', couponSchema);