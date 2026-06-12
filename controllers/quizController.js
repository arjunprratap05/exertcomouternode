const { Quiz, QuizAttempt } = require('../models/Quiz');
const AuditLog = require('../models/AuditLog');

 // [ADMIN] Create a new quiz with answers & log it
exports.createQuiz = async (req, res) => {
    try {
        const newQuiz = await Quiz.create({ ...req.body, status: 'LOCKED' });

        // Dynamically format the role & username from the JWT
        const rawRole = req.user?.role || "Unknown";
        const username = req.user?.username || "System";
        const formattedRole = rawRole.charAt(0).toUpperCase() + rawRole.slice(1);
        const adminIdentifier = `${formattedRole} (${username})`;

        // Write to your exact AuditLog schema
        await AuditLog.create({
            action: "Quiz Deployed",
            performedBy: adminIdentifier, 
            targetName: newQuiz.title,
            details: `Target Program: ${newQuiz.targetCourse}`
        });

        res.status(201).json({ success: true, data: newQuiz });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// [ADMIN] Get all quizzes (Includes answers for the admin dashboard)
exports.getAdminQuizzes = async (req, res) => {
    try {
        const quizzes = await Quiz.find().sort({ createdAt: -1 });

        // Enrich quizzes with attempt and pass analytics
        const quizzesWithAnalytics = await Promise.all(quizzes.map(async (quiz) => {
            const attempts = await QuizAttempt.find({ quizId: quiz._id });
            
            // Calculate UNIQUE students who attempted (so 3 retakes = 1 student)
            const uniqueStudentsAttempted = new Set(attempts.map(a => a.studentId.toString())).size;

            // Calculate UNIQUE students who passed
            const passingScore = Math.ceil(quiz.questions.length * 0.6); // 60% passing threshold
            const passedAttempts = attempts.filter(a => a.score >= passingScore);
            const uniqueStudentsPassed = new Set(passedAttempts.map(a => a.studentId.toString())).size;

            return {
                ...quiz.toObject(),
                studentsAttempted: uniqueStudentsAttempted,
                studentsPassed: uniqueStudentsPassed,
                totalAttempts: attempts.length
            };
        }));

        res.status(200).json({ success: true, data: quizzesWithAnalytics });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// [STUDENT] Fetch Quiz Data (STRIPPED OF ANSWERS)
exports.getQuizForStudent = async (req, res) => {
    try {
        // Excludes the 'correctIndex' field so students cannot cheat
        const quiz = await Quiz.findById(req.params.quizId).select('-questions.correctIndex');
        if (!quiz) return res.status(404).json({ success: false, message: "Quiz not found" });
        
        res.status(200).json({ success: true, data: quiz });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// [STUDENT] Submit & Auto-Grade securely
exports.submitQuiz = async (req, res) => {
    try {
        const { quizId } = req.params;
        const { studentAnswers } = req.body; 
        
        // SECURE: Get ID from the verified token
        const studentId = req.user._id || req.user.id; 

        // 1. Fetch Master Quiz first to establish grading rules
        const masterQuiz = await Quiz.findById(quizId);
        if (!masterQuiz) return res.status(404).json({ success: false, message: "Quiz not found" });

        if (!Array.isArray(studentAnswers)) {
            return res.status(400).json({ success: false, message: "Invalid answers format." });
        }

        // 2. MULTI-ATTEMPT SECURITY GATE
        const existingAttempts = await QuizAttempt.find({ studentId, quizId });
        
        // A. Block if they have hit the 3 attempt limit
        if (existingAttempts.length >= 3) {
            return res.status(403).json({ success: false, message: "Maximum attempts (3) reached for this exam." });
        }

        // B. Block if they have already passed it in a previous attempt
        const passingScore = Math.ceil(masterQuiz.questions.length * 0.6); // 60% pass rate
        const hasPassed = existingAttempts.some(attempt => attempt.score >= passingScore);
        if (hasPassed) {
            return res.status(403).json({ success: false, message: "You have already passed this exam. Retakes are locked." });
        }

        // 3. Auto-Grade the Exam
        let calculatedScore = 0;
        masterQuiz.questions.forEach((question, index) => {
            if (studentAnswers[index] !== null && studentAnswers[index] !== undefined && studentAnswers[index] === question.correctIndex) {
                calculatedScore++;
            }
        });

        // 4. Log the student's attempt to the ledger
        const attempt = await QuizAttempt.create({
            studentId,
            quizId,
            studentAnswers,
            score: calculatedScore,
            totalQuestions: masterQuiz.questions.length
        });

        res.status(200).json({ 
            success: true, 
            score: calculatedScore, 
            total: masterQuiz.questions.length,
            attemptId: attempt._id
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getStudentQuizzes = async (req, res) => {
    try {
        const studentId = req.user._id || req.user.id;
        
        const Student = require('../models/student');
        const student = await Student.findById(studentId);
        if (!student) return res.status(404).json({ success: false, message: "Student not found" });

        // Extract ALL courses the student is enrolled in (Checking both legacy and new array)
        const enrolledCourses = student.enrollments.map(e => e.course);
        if (student.course && !enrolledCourses.includes(student.course)) {
            enrolledCourses.push(student.course);
        }

        // Find quizzes that target their courses OR are marked as "ALL"
        const availableQuizzes = await Quiz.find({
            $or: [
                { targetCourse: { $in: enrolledCourses } },
                { targetCourse: "ALL" }
            ],
            status: 'ACTIVE'
        }).select('-questions.correctIndex'); 

        // Check attempts and "Pass" status for each quiz
        const quizzesWithAttempts = await Promise.all(availableQuizzes.map(async (quiz) => {
            // Fetch all attempts by this student for this quiz
            const attempts = await QuizAttempt.find({ studentId, quizId: quiz._id });
            
            // Define passing criteria (e.g., 60% of total questions)
            const passingScore = Math.ceil(quiz.questions.length * 0.6);
            
            // Check if ANY of the attempts met the passing score
            const hasPassed = attempts.some(attempt => attempt.score >= passingScore);

            return {
                ...quiz.toObject(),
                attemptsUsed: attempts.length,
                maxAttempts: 3,
                hasPassed: hasPassed
            };
        }));

        res.status(200).json({ success: true, data: quizzesWithAttempts });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.deleteQuiz = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Find the quiz first so we can log its name
        const quizToDelete = await Quiz.findById(id);
        if (!quizToDelete) return res.status(404).json({ success: false, message: "Quiz not found" });

        // Delete the quiz
        await Quiz.findByIdAndDelete(id);

        // Dynamically format the role & username from the JWT for the Audit Log
        const rawRole = req.user?.role || "Unknown";
        const username = req.user?.username || "System";
        const formattedRole = rawRole.charAt(0).toUpperCase() + rawRole.slice(1);
        const adminIdentifier = `${formattedRole} (${username})`;

        // Write to your AuditLog schema
        await AuditLog.create({
            action: "Quiz Terminated",
            performedBy: adminIdentifier, 
            targetName: quizToDelete.title,
            details: `Exam permanently deleted from vault`
        });

        res.status(200).json({ success: true, message: "Quiz deleted successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.toggleQuizStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const quiz = await Quiz.findById(id);
        if (!quiz) return res.status(404).json({ success: false, message: "Quiz not found" });

        // Flip the status
        quiz.status = quiz.status === 'ACTIVE' ? 'LOCKED' : 'ACTIVE';
        await quiz.save();

        // Audit Logging
        const rawRole = req.user?.role || "Unknown";
        const username = req.user?.username || "System";
        const formattedRole = rawRole.charAt(0).toUpperCase() + rawRole.slice(1);
        
        await AuditLog.create({
            action: quiz.status === 'ACTIVE' ? "Quiz Unlocked (Published)" : "Quiz Locked (Hidden)",
            performedBy: `${formattedRole} (${username})`, 
            targetName: quiz.title,
            details: `Visibility changed to ${quiz.status}`
        });

        res.status(200).json({ 
            success: true, 
            status: quiz.status,
            message: `Quiz is now ${quiz.status === 'ACTIVE' ? 'Visible to students' : 'Hidden from students'}`
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};