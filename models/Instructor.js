// models/Instructor.js
const mongoose = require('mongoose');

const instructorSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true 
    },
    subject: { 
        type: String, 
        required: true 
    },
    phone: { 
        type: String, 
        required: true 
    },
    totalHours: { 
        type: Number, 
        default: 0 
    },
    activeBatches: { 
        type: Number, 
        default: 0 
    },
    status: { 
        type: String, 
        enum: ['Active', 'On Leave'], 
        default: 'Active' 
    }
}, { timestamps: true });

module.exports = mongoose.model('Instructor', instructorSchema);