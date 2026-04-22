const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true }, // e.g., "cash_seq_FY_2026_27"
    seq: { type: Number, default: 0 }
});

module.exports = mongoose.models.Counter || mongoose.model('Counter', counterSchema);