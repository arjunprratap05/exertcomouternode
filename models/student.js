const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
    // --- EXISTING FIELDS ---
    name: { type: String, required: true },
    fatherName: { type: String, required: true },
    dob: { type: Date, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    aadhaarNo: { type: String, required: true },
    address: { type: String, required: true },
    highSchoolBoard: String,
    highSchoolYear: String,
    highSchoolPercent: String,
    interBoard: String,
    interYear: String,
    interPercent: String,
    course: { type: String, required: true },
    amountPaid: { type: Number, default: 0 }, 
    paymentStatus: { type: String, default: 'Pending' }, 
    enrollmentDate: { type: Date, default: Date.now },
    totalFee: { type: Number, default: 0 },

    // --- UPDATED IMAGE FIELD (FOR DIRECT MONGODB STORAGE) ---
    studentImage: {
        data: Buffer,       // Stores the raw binary data
        contentType: String // Stores the file type (e.g., image/jpeg)
    },

    // --- ERP & LOGIN FIELDS ---
    registrationId: { type: String, unique: true, sparse: true }, 
    password: { type: String }, 
    isApproved: { type: Boolean, default: false }, 
    role: { type: String, default: 'student' }
}, { timestamps: true });

module.exports = mongoose.models.Student || mongoose.model('Student', studentSchema);