const mongoose = require('mongoose');
const Lecture = require('../models/Lecture');
const Material = require('../models/Material');
const Batch = require('../models/Batch');
const courseData = require('../data/course'); 
const techCoursesData = courseData.techCoursesData || [];
const universityPrograms = courseData.universityPrograms || [];

const allConfiguredCourses = [...techCoursesData, ...universityPrograms];
// --- 1. ADD LECTURE (With Pre-populated Response Fix) ---
exports.addLecture = async (req, res) => {
    try {
        const newLecture = new Lecture(req.body);
        await newLecture.save();
        
        // Ensure immediate population so the UI doesn't drop layout rendering attributes
        const populatedLecture = await Lecture.findById(newLecture._id).populate('batchId', 'batchCode');
        
        res.status(201).json({ 
            success: true, 
            message: "Lecture live on Student Portal", 
            data: populatedLecture 
        });
    } catch (err) { 
        res.status(400).json({ success: false, message: err.message }); 
    }
};

// --- 2. ADD MATERIAL (Vault Input Logic) ---
exports.addMaterial = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: "PDF file missing" });
        }
        
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

// --- 3. GET ALL MATERIALS (Directory Index Layer) ---
exports.getAllMaterials = async (req, res) => {
    try {
        const materials = await Material.find()
            .select('-file.data') 
            .sort({ createdAt: -1 });

        res.json({ success: true, materials });
    } catch (err) {
        res.status(500).json({ success: false, message: "Internal Directory Error" });
    }
};

// --- 4. MULTI-BATCH SYNC AGGREGATOR (High-Performance Parallel Execution) ---
exports.syncMultiBatchLMS = async (req, res) => {
    try {
        const { batchIds } = req.body; 

        if (!batchIds || !Array.isArray(batchIds)) {
            return res.status(400).json({ success: false, message: "No streams authorized" });
        }

        // 1. Cast string IDs safely into valid Mongoose ObjectIds
        const validBatchObjectIds = batchIds
            .filter(id => id && mongoose.Types.ObjectId.isValid(id))
            .map(id => new mongoose.Types.ObjectId(id));

        if (validBatchObjectIds.length === 0) {
            return res.json({ success: true, data: { lectures: [], materials: [] } });
        }

        // 2. Resolve Active Authorized Batches from Payload
        const activeBatches = await Batch.find({ _id: { $in: validBatchObjectIds } });
        
        // 3. Compute Dynamic Search Identifiers List for loose tracking matches
        const authorizedIdentifiers = [];

        activeBatches.forEach(b => {
            if (b.courseId) {
                const cleanSlug = b.courseId.trim().toLowerCase();
                if (cleanSlug) {
                    authorizedIdentifiers.push(cleanSlug);
                    
                    // Reverse Slugs to Plain Text (e.g., "gen-ai-master" -> "gen ai master")
                    const spaceSeparated = cleanSlug.replace(/-/g, ' ');
                    authorizedIdentifiers.push(spaceSeparated);

                    // Map cross-referenced technical config titles dynamically from imported data
                    if (Array.isArray(allConfiguredCourses)) {
                        const matchedCourseMeta = allConfiguredCourses.find(c => {
                            if (!c || !c.id) return false;
                            const compareId = c.id.toLowerCase().trim();
                            return compareId === cleanSlug || cleanSlug.includes(compareId);
                        });

                        if (matchedCourseMeta && matchedCourseMeta.title) {
                            authorizedIdentifiers.push(matchedCourseMeta.title.trim().toLowerCase());
                        }
                    }

                    // Strip suffix terms for search variance protection
                    const cleanCore = spaceSeparated.replace(/\b(master|course|essentials|essential|programming|in|with|using)\b/gi, '').trim();
                    if (cleanCore) authorizedIdentifiers.push(cleanCore);
                }
            }

            if (b.courseName) authorizedIdentifiers.push(b.courseName.trim().toLowerCase());
            if (b.title) authorizedIdentifiers.push(b.title.trim().toLowerCase());
        });

        // De-duplicate array search tokens and filter out empty fields
        const searchTerms = [
            ...new Set(
                authorizedIdentifiers
                    .filter(Boolean)
                    .map(t => t.trim().toLowerCase())
                    .filter(t => t.length > 0)
            )
        ];

        // 4. Construct case-insensitive sub-string native MongoDB $or regex conditions
        let materialQueryCondition = { course: "__NON_EXISTENT_FALLBACK__" };
        let lectureRegexOrQuery = [];

        if (searchTerms.length > 0) {
            const materialRegexOrQuery = searchTerms.map(term => {
                const escapedTerm = term.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                return { course: new RegExp(escapedTerm, 'i') }; 
            });
            materialQueryCondition = { $or: materialRegexOrQuery };

            lectureRegexOrQuery = searchTerms.flatMap(term => {
                const escapedTerm = term.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                return [
                    { course: new RegExp(escapedTerm, 'i') },
                    { title: new RegExp(escapedTerm, 'i') }
                ];
            });
        }

        const lectureQueryCondition = lectureRegexOrQuery.length > 0 
            ? { $or: [{ batchId: { $in: validBatchObjectIds } }, ...lectureRegexOrQuery], isCancelled: false }
            : { batchId: { $in: validBatchObjectIds }, isCancelled: false };

        // 5. High-Performance Parallel Query Core
        const [lectures, materials] = await Promise.all([
            Lecture.find(lectureQueryCondition)
                .populate('batchId', 'batchCode startTime endTime')
                .sort({ createdAt: -1 }),
                
            Material.find(materialQueryCondition)
                .select('-file.data')
                .sort({ createdAt: -1 })
        ]);

        // 6. Return Aggregated Workspace Objects Payload
        res.json({
            success: true,
            data: { lectures, materials }
        });
    } catch (err) {
        console.error("LMS_AGGREGATOR_ERROR:", err);
        res.status(500).json({ success: false, message: "LMS Aggregation engine exception." });
    }
};

// --- 5. SECURE INLINE PDF STREAMING ---
exports.downloadMaterial = async (req, res) => {
    try {
        const material = await Material.findById(req.params.id);
        if (!material) {
            return res.status(404).json({ success: false, message: "Resource not found" });
        }

        // Enforce browser execution inside isolated secure viewport instead of forcing downloads
        res.set({
            'Content-Type': material.file.contentType,
            'Content-Disposition': 'inline', 
            'Cache-Control': 'no-store, no-cache, must-revalidate, private'
        });

        res.send(material.file.data);
    } catch (err) {
        res.status(500).json({ success: false, message: "Streaming lifecycle crashed" });
    }
};

// --- 6. ADMIN FETCH ALL LECTURES ---
exports.getAllLectures = async (req, res) => {
    try {
        const lectures = await Lecture.find()
            .populate('batchId', 'batchCode startTime')
            .sort({ createdAt: -1 });
            
        res.json({ success: true, data: lectures });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// --- 7. DESTRUCTION Lifecycles ---
exports.deleteLecture = async (req, res) => {
    try {
        const result = await Lecture.findByIdAndDelete(req.params.id);
        if (!result) {
            return res.status(404).json({ success: false, message: "Target document not found" });
        }
        res.status(200).json({ success: true, message: "Lecture removed" });
    } catch (err) {
        res.status(500).json({ success: false, message: "Deletion request rejected" });
    }
};

// --- 8. WIPE MATERIAL RECORD ---
exports.deleteMaterial = async (req, res) => {
    try {
        const material = await Material.findByIdAndDelete(req.params.id);
        if (!material) {
            return res.status(404).json({ success: false, message: "Not found" });
        }
        res.json({ success: true, message: "Resource wiped from Vault" });
    } catch (err) {
        res.status(500).json({ success: false, message: "Wipe sequence failed" });
    }
};