const mongoose = require('mongoose');

// 1. MASTER QUIZ SCHEMA
const quizSchema = new mongoose.Schema({
    title: { type: String, required: true },
    targetCourse: { type: String, required: true },
    durationMins: { type: Number, required: true },
    status: { type: String, default: 'ACTIVE' },
    questions: [{
        questionText: { type: String, required: true },
        options: [{ type: String, required: true }],
        correctIndex: { type: Number, required: true } // Stored securely in DB
    }],
    createdAt: { type: Date, default: Date.now }
});

// 2. STUDENT ATTEMPT LEDGER SCHEMA
const quizAttemptSchema = new mongoose.Schema({
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Registration', required: true },
    quizId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
    studentAnswers: [{ type: Number }], // Array of indices representing what the student clicked
    score: { type: Number, required: true },
    totalQuestions: { type: Number, required: true },
    submittedAt: { type: Date, default: Date.now }
});

module.exports = {
    Quiz: mongoose.model('Quiz', quizSchema),
    QuizAttempt: mongoose.model('QuizAttempt', quizAttemptSchema)
};