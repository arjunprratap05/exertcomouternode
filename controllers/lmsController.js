const mongoose = require('mongoose');
const Lecture = require('../models/Lecture');
const Material = require('../models/Material');
const Batch = require('../models/Batch');
const courseData = require('../data/course'); 
const Student = require('../models/student');
const { PDFDocument, rgb, degrees, StandardFonts } = require('pdf-lib');
const axios = require('axios');
const techCoursesData = courseData.techCoursesData || [];
const universityPrograms = courseData.universityPrograms || [];
const allConfiguredCourses = [...techCoursesData, ...universityPrograms];

// --- 1. ADD LECTURE ---
exports.addLecture = async (req, res) => {
    try {
        const newLecture = new Lecture(req.body);
        await newLecture.save();
        const populatedLecture = await Lecture.findById(newLecture._id).populate('batchId', 'batchCode');
        res.status(201).json({ success: true, message: "Lecture live", data: populatedLecture });
    } catch (err) { 
        res.status(400).json({ success: false, message: err.message }); 
    }
};

// --- 2. ADD MATERIAL ---
exports.addMaterial = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: "PDF file missing" });
        const material = new Material({
            title: req.body.title,
            course: req.body.course.toLowerCase().trim(),
            file: { data: req.file.buffer, contentType: req.file.mimetype, fileName: req.file.originalname }
        });
        await material.save();
        res.status(201).json({ success: true, message: "Material pushed to Course Vault" });
    } catch (err) { 
        res.status(400).json({ success: false, message: err.message }); 
    }
};

// --- 3. GET ALL MATERIALS ---
exports.getAllMaterials = async (req, res) => {
    try {
        const materials = await Material.find().select('-file.data').sort({ createdAt: -1 });
        res.json({ success: true, materials });
    } catch (err) {
        res.status(500).json({ success: false, message: "Internal Error" });
    }
};

// --- 4. MULTI-BATCH SYNC ---
exports.syncMultiBatchLMS = async (req, res) => {
    try {
        const { batchIds, explicitCourses = [] } = req.body; 
        if (!batchIds || !Array.isArray(batchIds)) return res.status(400).json({ success: false, message: "Invalid streams" });

        const validBatchObjectIds = batchIds.filter(id => id && mongoose.Types.ObjectId.isValid(id)).map(id => new mongoose.Types.ObjectId(id));
        if (validBatchObjectIds.length === 0) return res.json({ success: true, data: { lectures: [], materials: [] } });

        const activeBatches = await Batch.find({ _id: { $in: validBatchObjectIds } });
        const authorizedIdentifiers = [...explicitCourses];

        activeBatches.forEach(b => {
            if (b.courseId) {
                const cleanSlug = b.courseId.trim().toLowerCase();
                authorizedIdentifiers.push(cleanSlug, cleanSlug.replace(/-/g, ' '));
                const cleanCore = cleanSlug.replace(/-/g, ' ').replace(/\b(master|course|essentials|essential|programming|in|with|using)\b/gi, '').trim();
                if (cleanCore) authorizedIdentifiers.push(cleanCore);
            }
            if (b.courseName) authorizedIdentifiers.push(b.courseName.trim().toLowerCase());
        });

        const searchTerms = [...new Set(authorizedIdentifiers.filter(Boolean).map(t => t.trim().toLowerCase()).filter(t => t.length > 0))];
        const materialRegexOrQuery = searchTerms.map(term => ({ course: new RegExp(term.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i') }));
        
        const [lectures, materials] = await Promise.all([
            Lecture.find({ $or: [{ batchId: { $in: validBatchObjectIds } }, ...searchTerms.map(t => ({ course: new RegExp(t, 'i') })), ...searchTerms.map(t => ({ title: new RegExp(t, 'i') }))], isCancelled: { $ne: true } })
                .populate('batchId', 'batchCode startTime endTime'),
            Material.find(searchTerms.length > 0 ? { $or: materialRegexOrQuery } : {})
                .select('-file.data').sort({ createdAt: -1 })
        ]);

        res.json({ success: true, data: { lectures, materials } });
    } catch (err) {
        res.status(500).json({ success: false, message: "Aggregation failed" });
    }
};

// --- 5. SECURE WATERMARKED STREAMING ---
exports.downloadMaterial = async (req, res) => {
    try {
        const material = await Material.findById(req.params.id);
        if (!material || !material.file || !material.file.data) return res.status(404).json({ success: false, message: "Resource not found" });

        const pdfBytes = new Uint8Array(material.file.data.buffer || material.file.data);
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        
        pdfDoc.getPages().forEach(page => {
            const { width, height } = page.getSize();
            page.drawText('EXPERT COMPUTER ACADEMY', {
                x: width * 0.1,
                y: height * 0.2,
                size: width / 15,
                font: font,
                opacity: 0.2,
                rotate: degrees(30)
            });
        });

        const pdfData = await pdfDoc.save();
        res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline', 'Cache-Control': 'no-store' });
        res.send(Buffer.from(pdfData));
    } catch (err) {
        console.error("PDF Process Error:", err);
        res.status(500).json({ success: false, message: "Failed to process resource" });
    }
};

exports.getAllLectures = async (req, res) => {
    try {
        const lectures = await Lecture.find({}).sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: lectures });
    } catch (error) {
        console.error("Error fetching lectures:", error);
        res.status(500).json({ success: false, message: "Server Error" });
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


exports.handleStudentChat = async (req, res) => {
    try {
        const { message } = req.body;

        if (!message) {
            return res.status(400).json({ success: false, error: "Message is required." });
        }

        console.log(`[AI] Processing student query: "${message}"`);

        // 1. SMART DETECTION: Check if the student is asking for visual aids
        const wantsDiagram = /(diagram|image|picture|visual|draw|graph|chart|architecture)/i.test(message);

        // Connect to Tavily's Live Research API
        const response = await axios.post('https://api.tavily.com/search', {
            api_key: process.env.TAVILY_API_KEY,
            query: message,
            search_depth: "basic",
            include_answer: true, 
            include_images: wantsDiagram, // 2. Tell Tavily to scrape images if requested
            max_results: 3
        });

        let aiResponse = response.data.answer;
        
        // 3. Extract the images array (Default to empty array if none found)
        let aiImages = response.data.images || [];

        if (!aiResponse) {
            if (response.data.results && response.data.results.length > 0) {
                aiResponse = "I couldn't formulate a direct answer, but here is what I found in my live research:\n\n" + 
                             response.data.results.map((r, index) => `${index + 1}. ${r.content}`).join("\n\n");
            } else {
                aiResponse = "I'm sorry, but I couldn't find accurate information regarding that topic in my live database.";
            }
        }

        // 4. Return both the text and a max of 2 images to the frontend
        return res.status(200).json({ 
            success: true, 
            response: aiResponse,
            images: aiImages.slice(0, 2) // Limit to top 2 images to keep the chat UI clean
        });

    } catch (error) {
        console.error("Tavily AI Engine Error:", error.response?.data || error.message);
        return res.status(500).json({ success: false, error: "The AI Research Engine is currently experiencing high load. Please try again." });
    }
};