const Lecture = require('../models/Lecture');
const Material = require('../models/Material');

exports.addLecture = async (req, res) => {
    try {
        // CLEANUP: Added .trim() to prevent accidental space issues
        const courseName = req.body.course.toLowerCase().trim();
        const lecture = new Lecture({ ...req.body, course: courseName });
        
        await lecture.save();
        res.status(201).json({ success: true, message: "Lecture synced" });
    } catch (err) { res.status(400).json({ success: false }); }
};

exports.addMaterial = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: "PDF missing" });
        
        // CLEANUP: Added .trim() here too
        const courseName = req.body.course.toLowerCase().trim();
        
        const material = new Material({
            title: req.body.title,
            course: courseName,
            file: { 
                data: req.file.buffer, 
                contentType: req.file.mimetype, 
                fileName: req.file.originalname 
            }
        });
        await material.save();
        res.status(201).json({ success: true, message: "Material pushed" });
    } catch (err) { res.status(400).json({ success: false }); }
};

exports.getCourseContent = async (req, res) => {
    try {
        const courseId = decodeURIComponent(req.params.courseId).trim();

        // This Regex ensures "gen-ai-master" matches even if it's "Gen-Ai-Master" in the DB
        const query = { course: { $regex: new RegExp(`^${courseId}$`, 'i') } };

        const [lectures, materials] = await Promise.all([
            Lecture.find(query).sort({ createdAt: -1 }),
            Material.find(query).select('-file.data').sort({ createdAt: -1 })
        ]);

        res.json({ success: true, data: { lectures, materials } });
    } catch (err) {
        res.status(500).json({ success: false });
    }
};

exports.downloadMaterial = async (req, res) => {
    try {
        const material = await Material.findById(req.params.id);
        if (!material) return res.status(404).json({ message: "File not found" });

        // Set headers so the browser treats it as a file download
        res.set({
            'Content-Type': material.file.contentType,
            'Content-Disposition': `attachment; filename="${material.file.fileName}"`,
        });

        res.send(material.file.data);
    } catch (err) {
        res.status(500).json({ success: false, message: "Download failed" });
    }
};

exports.getAllLectures = async (req, res) => {
    try {
        // Fetch all, newest first. 
        // We don't filter by course here because the Admin needs the full schedule.
        const lectures = await Lecture.find().sort({ createdAt: -1 });
        res.status(200).json({ success: true, lectures });
    } catch (err) {
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

// --- DELETE LECTURE ---
exports.deleteLecture = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedLecture = await Lecture.findByIdAndDelete(id);

        if (!deletedLecture) {
            return res.status(404).json({ success: false, message: "Lecture not found" });
        }

        res.status(200).json({ success: true, message: "Lecture removed successfully" });
    } catch (err) {
        res.status(500).json({ success: false, message: "Delete operation failed" });
    }
};