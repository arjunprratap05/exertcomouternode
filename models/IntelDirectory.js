const mongoose = require('mongoose');

const intelDirectorySchema = new mongoose.Schema({
    searchType: { 
        type: String, 
        required: true,
        enum: ['PHONE_LOOKUP', 'LINKEDIN_RESEARCH'] 
    },
    queryTarget: { 
        type: String, 
        required: true 
    },
    extractedData: { 
        type: String, 
        required: true 
    },
    performedBy: { 
        type: String, 
        default: 'Executive Co-Pilot' 
    }
}, { timestamps: true });

module.exports = mongoose.model('IntelDirectory', intelDirectorySchema);