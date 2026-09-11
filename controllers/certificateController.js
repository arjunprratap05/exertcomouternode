const Student = require('../models/student');

/**
 * 1. STUDENT: Submit Certificate Request
 * Validates 100% curriculum progress and passing exam grade
 */
exports.requestCertificate = async (req, res) => {
    try {
        const studentId = req.user.id || req.user._id;
        const { courseTitle } = req.body; // Target course to certify

        const student = await Student.findById(studentId);
        if (!student) {
            return res.status(404).json({ success: false, message: "Student account not found." });
        }

        // Check if student has nested enrollment for this course
        let enrollment = student.enrollments?.find(
            e => e.course?.toLowerCase() === courseTitle?.toLowerCase()
        );

        let isCompleted = false;
        let isExamCleared = false;

        if (enrollment) {
            isCompleted = enrollment.status === 'Completed' || enrollment.curriculumProgress >= 100;
            isExamCleared = enrollment.examPassed || enrollment.examScore >= 50;

            if (!isCompleted || !isExamCleared) {
                return res.status(400).json({
                    success: false,
                    message: "Requirements incomplete: 100% course syllabus and a cleared final examination are required."
                });
            }

            if (enrollment.certificateRequest?.status === 'PENDING') {
                return res.status(400).json({ success: false, message: "Request already in queue." });
            }

            enrollment.certificateRequest = {
                status: 'PENDING',
                requestedAt: new Date()
            };
        } else {
            // Fallback: Legacy root fields
            isCompleted = student.courseCompleted || student.curriculumProgress >= 100;
            isExamCleared = student.examPassed || student.examScore >= 50;

            if (!isCompleted || !isExamCleared) {
                return res.status(400).json({
                    success: false,
                    message: "Requirements incomplete: 100% course syllabus and a cleared final examination are required."
                });
            }

            if (student.certificateRequest?.status === 'PENDING') {
                return res.status(400).json({ success: false, message: "Request already in queue." });
            }

            student.certificateRequest = {
                status: 'PENDING',
                requestedAt: new Date()
            };
        }

        await student.save();

        return res.json({
            success: true,
            message: "Certificate request received. Administrative verification in progress.",
            status: 'PENDING'
        });
    } catch (err) {
        console.error("Certificate Request Failure:", err);
        return res.status(500).json({ success: false, message: "Server error logging certificate request." });
    }
};

/**
 * 2. ADMIN: Get All Pending/Processed Certificate Requests
 * Provides exam score, progress %, and course details to the Admin Dashboard
 */
exports.getCertificateRequests = async (req, res) => {
    try {
        const students = await Student.find({
            $or: [
                { "enrollments.certificateRequest.status": { $in: ['PENDING', 'APPROVED', 'REJECTED'] } },
                { "certificateRequest.status": { $in: ['PENDING', 'APPROVED', 'REJECTED'] } }
            ]
        }).select('name phone email enrollments course courseCompleted curriculumProgress examPassed examScore certificateRequest');

        // Normalize data for the admin table
        const formattedRequests = [];

        students.forEach(s => {
            // Extract from enrollments array
            if (s.enrollments && s.enrollments.length > 0) {
                s.enrollments.forEach(en => {
                    if (en.certificateRequest && en.certificateRequest.status !== 'NONE') {
                        formattedRequests.push({
                            studentId: s._id,
                            enrollmentId: en._id,
                            name: s.name,
                            phone: s.phone,
                            email: s.email,
                            course: en.course,
                            curriculumProgress: en.curriculumProgress || (en.status === 'Completed' ? 100 : 0),
                            examPassed: en.examPassed,
                            examScore: en.examScore,
                            requestStatus: en.certificateRequest.status,
                            requestedAt: en.certificateRequest.requestedAt,
                            hasPdf: Boolean(en.certificateRequest.certificateFile)
                        });
                    }
                });
            }

            // Extract from root legacy if present
            if (s.certificateRequest && s.certificateRequest.status !== 'NONE') {
                formattedRequests.push({
                    studentId: s._id,
                    name: s.name,
                    phone: s.phone,
                    email: s.email,
                    course: s.course,
                    curriculumProgress: s.curriculumProgress || (s.courseCompleted ? 100 : 0),
                    examPassed: s.examPassed,
                    examScore: s.examScore,
                    requestStatus: s.certificateRequest.status,
                    requestedAt: s.certificateRequest.requestedAt,
                    hasPdf: Boolean(s.certificateRequest.certificateFile)
                });
            }
        });

        return res.json({
            success: true,
            count: formattedRequests.length,
            data: formattedRequests
        });
    } catch (err) {
        console.error("Fetch Certificate Requests Error:", err);
        return res.status(500).json({ success: false, message: "Failed to fetch student requests." });
    }
};

/**
 * 3. ADMIN: Upload Official Signed Certificate PDF
 * Attaches PDF, approves request, and unlocks student download
 */
exports.uploadCertificatePdf = async (req, res) => {
    try {
        const { studentId } = req.params;
        const { courseTitle, remarks } = req.body;
        const adminName = req.user?.name || req.user?.username || "Admin Team";
        const file = req.file;

        if (!file) {
            return res.status(400).json({ success: false, message: "PDF document file is required." });
        }

        const student = await Student.findById(studentId);
        if (!student) {
            return res.status(404).json({ success: false, message: "Student record not found." });
        }

        let updated = false;

        // Try updating inside enrollments array
        if (student.enrollments && student.enrollments.length > 0) {
            const en = student.enrollments.find(e => e.course?.toLowerCase() === courseTitle?.toLowerCase());
            if (en) {
                en.status = 'Completed';
                en.certificateRequest = {
                    status: 'APPROVED',
                    reviewedAt: new Date(),
                    reviewedBy: adminName,
                    certificateFile: file.buffer,
                    certificateMimeType: file.mimetype,
                    remarks: remarks || "Certified and stamped by Expert Academy Examination Board."
                };
                updated = true;
            }
        }

        // Fallback: Legacy root
        if (!updated) {
            student.courseCompleted = true;
            student.certificateRequest = {
                status: 'APPROVED',
                reviewedAt: new Date(),
                reviewedBy: adminName,
                certificateFile: file.buffer,
                certificateMimeType: file.mimetype,
                remarks: remarks || "Certified and stamped by Expert Academy Examination Board."
            };
        }

        await student.save();

        return res.json({
            success: true,
            message: `Certificate successfully issued and uploaded for ${student.name}.`
        });
    } catch (err) {
        console.error("Upload Certificate Error:", err);
        return res.status(500).json({ success: false, message: "Failed to upload certificate document." });
    }
};

/**
 * 4. STUDENT: Stream & Download Official Certificate PDF
 */
exports.downloadCertificatePdf = async (req, res) => {
    try {
        const studentId = req.user.id || req.user._id;
        const course = req.query.course;

        const student = await Student.findById(studentId);
        if (!student) {
            return res.status(404).json({ success: false, message: "Student record not found." });
        }

        let certificateData = null;

        // Search nested enrollments
        if (student.enrollments && course) {
            const en = student.enrollments.find(e => e.course?.toLowerCase() === course.toLowerCase());
            if (en?.certificateRequest?.certificateFile) {
                certificateData = en.certificateRequest;
            }
        }

        // Fallback root
        if (!certificateData && student.certificateRequest?.certificateFile) {
            certificateData = student.certificateRequest;
        }

        if (!certificateData) {
            return res.status(404).json({ success: false, message: "No issued diploma found on file." });
        }

        res.setHeader('Content-Type', certificateData.certificateMimeType || 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Certificate-${student.name.replace(/\s+/g, '_')}.pdf"`);

        return res.send(certificateData.certificateFile);
    } catch (err) {
        console.error("Certificate Download Error:", err);
        return res.status(500).json({ success: false, message: "Error downloading certificate." });
    }
};