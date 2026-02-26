const mongoose = require('mongoose');

const materialSchema = new mongoose.Schema({
    title: { type: String, required: true },
    course: { 
        type: String, 
        required: true 
        // Note: This validates against your IDs like 'java-pro'
    },
    file: {
        data: Buffer,
        contentType: String,
        fileName: String
    },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Material', materialSchema);