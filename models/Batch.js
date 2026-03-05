const mongoose = require('mongoose');

const batchSchema = new mongoose.Schema({
    batchCode: { type: String, required: true, unique: true }, // e.g., JAVA-MAR-MORN
    courseId: { type: String, required: true }, // e.g., java-pro
    startTime: { type: String, required: true }, // e.g., 10:00 AM
    endTime: { type: String, required: true },
    days: [{ type: String }], // ['Mon', 'Wed', 'Fri']
    active: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Batch', batchSchema);