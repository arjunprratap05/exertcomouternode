const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const quizController = require('../controllers/quizController');

// Import your custom RBAC middleware
const { authMiddleware, authorize } = require('../middleware/authMiddleware');

// ==========================================
// ADMIN ROUTES
// ==========================================

// Create a quiz
router.post(
    '/admin/quizzes', 
    authMiddleware, 
    authorize('founder', 'accounts', 'frontoffice'), 
    quizController.createQuiz
);

// Fetch quizzes for admin dashboard
router.get(
    '/admin/quizzes', 
    authMiddleware, 
    authorize('founder', 'accounts', 'frontoffice'), 
    quizController.getAdminQuizzes
);

router.get(
    '/student/quizzes/:quizId', 
    authMiddleware, 
    authorize('student'), 
    quizController.getQuizForStudent
);

// Submit answers and get score
router.post(
    '/student/quizzes/:quizId/submit', 
    authMiddleware, 
    authorize('student'), 
    quizController.submitQuiz
);

router.get(
    '/student/quizzes', 
    authMiddleware, 
    authorize('student'), 
    quizController.getStudentQuizzes
);

router.delete(
    '/admin/quizzes/:id', 
    authMiddleware, 
    authorize('founder', 'accounts', 'frontoffice'), 
    quizController.deleteQuiz
);

router.patch(
    '/admin/quizzes/:id/status', 
    authMiddleware, 
    authorize('founder', 'accounts', 'frontoffice'), 
    quizController.toggleQuizStatus
);

router.post('/quizzes/generate-from-pdf', upload.single('document'), quizController.generateQuizFromPdf);


module.exports = router;