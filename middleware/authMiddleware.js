const jwt = require('jsonwebtoken');
const { techCoursesData, universityPrograms } = require('../data/course');

const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(403).json({ success: false, message: "No token provided" });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; 

        /**
         * PROD UPDATE: Security Lock
         * We only validate Course Mismatch if:
         * 1. The user is a student
         * 2. The route specifically provides a 'courseId' (like fetching content)
         */
        if (req.user.role === 'student' && req.params.courseId) {
            const requestedId = req.params.courseId.toLowerCase().trim();
            const userEnrolledTitle = req.user.course; 

            const allCourses = [...techCoursesData, ...universityPrograms];
            const courseMatch = allCourses.find(c => 
                c.title.trim().toLowerCase() === userEnrolledTitle.trim().toLowerCase()
            );
            
            const authorizedId = courseMatch ? courseMatch.id : userEnrolledTitle.toLowerCase().trim();

            if (requestedId !== authorizedId) {
                return res.status(403).json({ 
                    success: false, 
                    message: "Unauthorized: Enrollment Mismatch" 
                });
            }
        }

        // If it's an ADMIN or the route doesn't require course validation, proceed
        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: "Session expired" });
    }
};

const authorize = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ success: false, message: "Access denied: Insufficient Permissions" });
        }
        next();
    };
};

module.exports = { authMiddleware, authorize };