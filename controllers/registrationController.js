const Student = require('../models/Student');
const Coupon = require('../models/Coupon');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

exports.handleRegistration = async (req, res) => {
    try {
        const { email, aadhaarNo, course, totalFee, appliedCoupon } = req.body;
        
        // This variable will hold what we eventually save to 'totalFee' in DB
        let finalPayableAmount = Number(totalFee); 
        let couponData = null;

        // --- CASE 1: COUPON APPLIED ---
        if (appliedCoupon) {
            try {
                couponData = JSON.parse(appliedCoupon);
                
                // Atomic check and increment
                const updatedCoupon = await Coupon.findOneAndUpdate(
                    { 
                        code: couponData.code.toUpperCase(), 
                        isActive: true,
                        $expr: { $lt: ["$usedCount", "$maxUsage"] } 
                    },
                    { $inc: { usedCount: 1 } },
                    { new: true }
                );

                if (!updatedCoupon) {
                    return res.status(400).json({ 
                        success: false, 
                        message: "Coupon invalid or limit reached. Please register without a coupon or use a different one." 
                    });
                }
                // The amount sent from frontend (discounted) is used
                finalPayableAmount = Number(totalFee); 
            } catch (e) {
                console.error("Coupon Parsing Error:", e);
            }
        } 
        
        // --- CASE 2: NO COUPON ---
        // If appliedCoupon is null/undefined, finalPayableAmount remains 
        // the original course price sent via 'totalFee' from the frontend.

        // 1. Identity Check (Aadhaar is unique anchor)
        let student = await Student.findOne({ aadhaarNo });

        if (student) {
            // Returning Student Logic
            const alreadyEnrolled = student.enrollments.some(e => e.course === course);
            if (alreadyEnrolled) {
                return res.status(400).json({ success: false, message: "Already registered for this course." });
            }

            student.enrollments.push({ course, enrolledAt: new Date(), status: 'Applied' });
            
            // Add the new amount to the cumulative totalFee
            student.totalFee += finalPayableAmount; 
            
            if (couponData) {
                student.appliedCoupon = {
                    code: couponData.code,
                    discountValue: couponData.discountValue
                };
            }

            await student.save();
            return res.status(201).json({ 
                success: true, 
                isReturning: true, 
                registrationId: student.registrationId 
            });
        }

        // 2. New Student Logic
        const rawPassword = crypto.randomBytes(4).toString('hex').toUpperCase();
        const hashedPassword = await bcrypt.hash(rawPassword, 12);

        const newStudent = new Student({
            ...req.body,
            email: email.toLowerCase().trim(),
            password: hashedPassword,
            registrationId: email.toLowerCase().trim(),
            totalFee: finalPayableAmount, // STORES CASE 1 or CASE 2 amount
            appliedCoupon: couponData,
            enrollments: [{ course, status: 'Applied' }]
        });

        await newStudent.save();
        
        res.status(201).json({ 
            success: true, 
            isReturning: false, 
            registrationId: newStudent.registrationId, 
            rawPassword 
        });

    } catch (error) {
        console.error("REGISTRATION_FLOW_ERROR:", error);
        res.status(500).json({ success: false, message: "Server Error: " + error.message });
    }
};