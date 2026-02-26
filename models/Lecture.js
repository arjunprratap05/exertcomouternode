const mongoose = require('mongoose');
const { techCoursesData, universityPrograms } = require('../data/course'); // Path to your courses file

// Map all course IDs into one array for validation
const validCourseIds = [
    ...techCoursesData.map(c => c.id),
    ...universityPrograms.map(u => u.id)
];

const lectureSchema = new mongoose.Schema({
    title: { type: String, required: true },
    teacher: { type: String, required: true },
    time: { type: String, required: true },
    course: { 
        type: String, 
        required: true, 
        enum: validCourseIds // Dynamically allows only IDs like 'java-pro', 'mzu-mca', etc.
    },
    link: { type: String, required: true },
    status: { type: String, enum: ['live', 'upcoming', 'completed'], default: 'upcoming' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Lecture', lectureSchema);