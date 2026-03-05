const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(403).json({ success: false, message: "No token provided" });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; 

        // SECURITY: Verify Batch ownership for students
        if (req.user.role === 'student' && req.params.batchId) {
            if (req.params.batchId !== req.user.batchId?.toString()) {
                return res.status(403).json({ success: false, message: "Batch Mismatch" });
            }
        }
        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: "Session expired" });
    }
};

// CRITICAL FIX: Ensure this is exported as a function
const authorize = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ success: false, message: "Unauthorized Role" });
        }
        next();
    };
};

module.exports = { authMiddleware, authorize };