const mongoose = require('mongoose');

const lectureSchema = new mongoose.Schema({
    batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', required: true }, 
    course: { type: String, required: true }, // Course ID (e.g. 'java-pro')
    title: { type: String, required: true },
    teacher: { type: String, required: true },
    time: { type: String, required: true }, 
    link: { type: String, required: true },
    status: { type: String, enum: ['live', 'upcoming', 'completed'], default: 'upcoming' },
    isCancelled: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Lecture', lectureSchema);