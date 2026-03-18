const Coupon = require('../models/Coupon');
const Student = require('../models/student'); // Ensure path is correct

// 1. Create Coupon (Merged Payload)
exports.createCoupon = async (req, res) => {
    try {
        const coupon = await Coupon.create(req.body);
        res.status(201).json({ success: true, data: coupon });
    } catch (error) {
        if (error.code === 11000) return res.status(400).json({ success: false, message: "Code already exists" });
        res.status(400).json({ success: false, message: error.message });
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