const Coupon = require('../models/Coupon');
const Student = require('../models/student'); // Ensure path is correct

// 1. Create Coupon (Merged Payload)
exports.createCoupon = async (req, res) => {
    try {
        // 1. Extract and Sanitize Data
        const couponData = { ...req.body };

        // 2. Handle the "FLAT" vs "FIXED" mismatch
        // If frontend sends 'FLAT', map it to 'FIXED' to satisfy Mongoose Enum
        if (couponData.discountType === 'FLAT') {
            couponData.discountType = 'FIXED';
        }

        // 3. Ensure code is Uppercase and Trimmed
        if (couponData.code) {
            couponData.code = couponData.code.toUpperCase().trim();
        }

        // 4. Manual check for Duplicate (optional, but good for custom logging)
        const existing = await Coupon.findOne({ code: couponData.code });
        if (existing) {
            return res.status(400).json({ 
                success: false, 
                message: `The coupon code "${couponData.code}" is already in use.` 
            });
        }

        // 5. Create the Coupon
        const coupon = await Coupon.create(couponData);

        res.status(201).json({ 
            success: true, 
            message: "Coupon deployed successfully",
            data: coupon 
        });

    } catch (error) {
        console.error("Coupon Creation Error:", error);
        
        // Handle Mongoose Unique Index Error (Code 11000)
        if (error.code === 11000) {
            return res.status(400).json({ 
                success: false, 
                message: "Deployment Failed: This code already exists in the registry." 
            });
        }

        // Handle Enum validation errors (like the one you just had)
        if (error.name === 'ValidationError') {
            return res.status(400).json({ 
                success: false, 
                message: "Schema Validation Failed: Please check discount type or mandatory fields." 
            });
        }

        res.status(500).json({ 
            success: false, 
            message: "Internal Server Error during deployment." 
        });
    }
};

// 2. Get All Coupons
exports.getAllCoupons = async (req, res) => {
    try {
        const coupons = await Coupon.find().sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: coupons });
    } catch (err) { res.status(500).json({ success: false }); }
};

// 3. Get Usage History (Linked to Registrations)
exports.getCouponHistory = async (req, res) => {
    try {
        const history = await Student.find({ "appliedCoupon.code": { $exists: true } })
            .select('name phone email appliedCoupon createdAt')
            .sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: history });
    } catch (err) { res.status(500).json({ success: false }); }
};

// 4. Validate Coupon (For Frontend Forms)
exports.validateCoupon = async (req, res) => {
    try {
        const { code, courseTitle } = req.body;
        const coupon = await Coupon.findOne({ code: code.toUpperCase(), isActive: true });

        if (!coupon) return res.status(404).json({ success: false, message: "Invalid Code" });
        if (new Date() > coupon.validTo) return res.status(400).json({ success: false, message: "Expired" });
        if (coupon.usedCount >= coupon.maxUsage) return res.status(400).json({ success: false, message: "Limit Reached" });
        if (coupon.courseCode !== 'ALL' && coupon.courseCode !== courseTitle) {
            return res.status(400).json({ success: false, message: "Not valid for this course" });
        }

        res.status(200).json({ success: true, discountType: coupon.discountType, discountValue: coupon.discountValue });
    } catch (err) { res.status(500).json({ success: false }); }
};

// 5. Delete Coupon
exports.deleteCoupon = async (req, res) => {
    try {
        await Coupon.findByIdAndDelete(req.params.id);
        res.status(200).json({ success: true, message: "Deleted" });
    } catch (err) { res.status(500).json({ success: false }); }
};