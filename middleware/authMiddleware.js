const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) return res.status(403).json({ success: false, message: "No token provided" });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; 

        // SECURITY: Multi-Stream Ownership Check
        // Only apply this check to 'student' roles. 
        // We skip this for 'founder', 'accounts', etc., so they can manage all batches.
        if (req.user.role === 'student' && req.params.batchId) {
            
            // Convert to string to ensure matching if one is an ObjectId
            const authorizedBatches = req.user.activeBatches?.map(id => id.toString()) || [];
            const requestedBatchId = req.params.batchId.toString();

            const hasAccess = authorizedBatches.includes(requestedBatchId);
            
            if (!hasAccess) {
                return res.status(403).json({ 
                    success: false, 
                    message: "Security Violation: Unauthorized Stream Access" 
                });
            }
        }
        
        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: "Security Session expired" });
    }
};

/**
 * Role-Based Access Control (RBAC)
 */
const authorize = (...allowedRoles) => {
    return (req, res, next) => {
        // Ensure user is authenticated and has the correct role
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ 
                success: false, 
                message: `Forbidden: ${allowedRoles.join('/')} clearance required` 
            });
        }
        next();
    };
};

module.exports = { authMiddleware, authorize };