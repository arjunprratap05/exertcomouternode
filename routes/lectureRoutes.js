const express = require('express');
const router = express.Router();
const Lecture = require('../models/Lecture');
const { authMiddleware, authorize } = require('../middleware/authMiddleware');

// --- 1. ADMIN ACTION: ADD LECTURE ---
// Only 'founder', 'accounts', or 'frontoffice' can post new sessions
router.post('/add', 
    authMiddleware, 
    authorize('founder', 'accounts', 'frontoffice'), 
    async (req, res) => {
        try {
            const lecture = new Lecture(req.body);
            await lecture.save();
            res.status(201).json({ success: true, message: "Lecture live on Student Portal" });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    }
);

// --- 2. STUDENT ACTION: GET LECTURES BY COURSE ---
// Fetches lectures based on the student's enrolled course
router.get('/:courseName', authMiddleware, async (req, res) => {
    try {
        const batch = req.params.courseName.toUpperCase();
        // Sorting by newest first
        const lectures = await Lecture.find({ course: batch }).sort({ createdAt: -1 });
        res.json({ success: true, lectures });
    } catch (err) {
        res.status(500).json({ success: false, message: "Could not sync lectures" });
    }
});

// --- 3. ADMIN ACTION: DELETE LECTURE ---
router.delete('/:id', 
    authMiddleware, 
    authorize('founder'), 
    async (req, res) => {
        try {
            await Lecture.findByIdAndDelete(req.params.id);
            res.json({ success: true, message: "Lecture removed" });
        } catch (err) {
            res.status(500).json({ success: false });
        }
    }
);

module.exports = router;