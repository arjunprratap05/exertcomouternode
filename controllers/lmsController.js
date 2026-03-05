const mongoose = require('mongoose');
const Lecture = require('../models/Lecture');
const Material = require('../models/Material');
const Batch = require('../models/Batch');

// --- 1. ADD LECTURE (Linked to Batch) ---
exports.addLecture = async (req, res) => {
    try {
        const lecture = new Lecture(req.body);
        await lecture.save();
        res.status(201).json({ success: true, message: "Lecture synced to Batch" });
    } catch (err) { 
        res.status(400).json({ success: false, message: err.message }); 
    }
};

// --- 2. ADD MATERIAL (Course-Based Logic) ---
exports.addMaterial = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: "PDF file missing" });
        
        // We link material to the 'course' slug/ID (e.g., 'java-pro') 
        // instead of a specific Batch ID to avoid multiple uploads.
        const material = new Material({
            title: req.body.title,
            course: req.body.course.toLowerCase().trim(),
            file: { 
                data: req.file.buffer, 
                contentType: req.file.mimetype, 
                fileName: req.file.originalname 
            }
        });

        await material.save();
        res.status(201).json({ success: true, message: "Material pushed to Course Vault" });
    } catch (err) { 
        console.error("Upload Error:", err);
        res.status(400).json({ success: false, message: err.message }); 
    }
};

// --- 3. GET ALL MATERIALS (Admin side) ---
exports.getAllMaterials = async (req, res) => {
    try {
        // Optimization: Do NOT send binary file data in a list view
        const materials = await Material.find()
            .select('-file.data') 
            .sort({ createdAt: -1 });

        res.json({ success: true, materials });
    } catch (err) {
        res.status(500).json({ success: false, message: "Internal Directory Error" });
    }
};

// --- 4. MULTI-BATCH SYNC AGGREGATOR (Student side) ---
exports.syncMultiBatchLMS = async (req, res) => {
    try {
        const { batchIds } = req.body; 

        if (!batchIds || !Array.isArray(batchIds)) {
            return res.status(400).json({ success: false, message: "No streams authorized" });
        }

        // A. Resolve which unique courses these batches belong to
        const activeBatches = await Batch.find({ _id: { $in: batchIds } });
        const authorizedCourseSlugs = [...new Set(activeBatches.map(b => b.courseId.toLowerCase().trim()))];

        // B. High-Performance Parallel Fetch
        const [lectures, materials] = await Promise.all([
            // Lectures: Specific to the user's batch timings
            Lecture.find({ batchId: { $in: batchIds }, isCancelled: false }).sort({ createdAt: -1 }),
            
            // Materials: Available to anyone enrolled in the Course, regardless of batch
            Material.find({ course: { $in: authorizedCourseSlugs } })
                    .select('-file.data')
                    .sort({ createdAt: -1 })
        ]);

        res.json({
            success: true,
            data: { lectures, materials }
        });
    } catch (err) {
        console.error("LMS_AGGREGATOR_ERROR:", err);
        res.status(500).json({ success: false });
    }
};

// --- 5. SECURE PDF STREAMING ---
exports.downloadMaterial = async (req, res) => {
    try {
        const material = await Material.findById(req.params.id);
        if (!material) return res.status(404).json({ message: "Resource not found" });

        // Force browser to use secure inline viewer
        res.set({
            'Content-Type': material.file.contentType,
            'Content-Disposition': 'inline', 
            'Cache-Control': 'no-store'
        });

        res.send(material.file.data);
    } catch (err) {
        res.status(500).json({ success: false, message: "Streaming failed" });
    }
};

// --- 6. ADMIN FETCH ALL LECTURES ---
exports.getAllLectures = async (req, res) => {
    try {
        const lectures = await Lecture.find().sort({ createdAt: -1 });
        res.status(200).json({ success: true, lectures });
    } catch (err) {
        res.status(500).json({ success: false });
    }
};

// --- 7. DELETE OPERATIONS ---
exports.deleteLecture = async (req, res) => {
    try {
        await Lecture.findByIdAndDelete(req.params.id);
        res.status(200).json({ success: true, message: "Lecture removed" });
    } catch (err) {
        res.status(500).json({ success: false });
    }
};

exports.deleteMaterial = async (req, res) => {
    try {
        const material = await Material.findByIdAndDelete(req.params.id);
        if (!material) return res.status(404).json({ success: false, message: "Not found" });
        res.json({ success: true, message: "Resource wiped from Vault" });
    } catch (err) {
        res.status(500).json({ success: false });
    }
};