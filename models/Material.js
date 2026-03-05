const mongoose = require('mongoose');

const materialSchema = new mongoose.Schema({
    title: { type: String, required: true },
    // This will store 'java-pro', 'gen-ai', etc.
    course: { type: String, required: true }, 
    file: {
        data: Buffer,
        contentType: String,
        fileName: String
    },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Material', materialSchema);