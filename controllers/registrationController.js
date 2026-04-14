const Student = require('../models/student');
const Coupon = require('../models/Coupon');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { sendRegistrationEmail } = require('../services/mailService');

exports.handleRegistration = async (req, res) => {
    try {
        const { name, email, aadhaarNo, course, totalFee, appliedCoupon } = req.body;
        
        let finalPayableAmount = Number(totalFee); 
        let couponData = null;

        // 1. COUPON VERIFICATION
        if (appliedCoupon) {
            try {
                const parsedCoupon = JSON.parse(appliedCoupon);
                const updatedCoupon = await Coupon.findOneAndUpdate(
                    { 
                        code: parsedCoupon.code.toUpperCase(), 
                        isActive: true,
                        $expr: { $lt: ["$usedCount", "$maxUsage"] } 
                    },
                    { $inc: { usedCount: 1 } },
                    { new: true }
                );

                if (!updatedCoupon) {
                    return res.status(400).json({ 
                        success: false, 
                        message: "Coupon invalid or limit reached." 
                    });
                }
                couponData = {
                    code: updatedCoupon.code,
                    discountValue: updatedCoupon.discountValue
                };
            } catch (e) {
                console.error("Coupon Parsing Error:", e);
            }
        }

        // 2. CHECK IF STUDENT EXISTS
        let student = await Student.findOne({ aadhaarNo });

        if (student) {
            // RETURNING STUDENT LOGIC
            const alreadyEnrolled = student.enrollments.some(e => e.course === course);
            if (alreadyEnrolled) {
                return res.status(400).json({ success: false, message: "Already registered for this course." });
            }

            student.enrollments.push({ course, enrolledAt: new Date(), status: 'Applied' });
            student.totalFee += finalPayableAmount; 
            
            if (couponData) student.appliedCoupon = couponData;

            await student.save();

            // TRIGGER MAIL
            try {
                await sendRegistrationEmail({
                    email: student.email,
                    name: student.name,
                    selectedCourse: course,
                    registrationId: student.registrationId,
                    isReturning: true
                });
            } catch (mailErr) {
                console.error("Mail sending failed for returning student:", mailErr);
                // We don't return error here because DB save was successful
            }

            return res.status(201).json({ 
                success: true, 
                isReturning: true, 
                registrationId: student.registrationId 
            });
        }

        // 3. NEW STUDENT LOGIC
        const rawPassword = crypto.randomBytes(4).toString('hex').toUpperCase();
        const hashedPassword = await bcrypt.hash(rawPassword, 12);
        const normalizedEmail = email.toLowerCase().trim();

        const newStudent = new Student({
            ...req.body,
            email: normalizedEmail,
            password: hashedPassword,
            registrationId: normalizedEmail, 
            totalFee: finalPayableAmount,
            appliedCoupon: couponData,
            enrollments: [{ course, status: 'Applied' }]
        });

        await newStudent.save();

        // TRIGGER MAIL
        try {
            await sendRegistrationEmail({
                email: normalizedEmail,
                name: name,
                selectedCourse: course,
                registrationId: normalizedEmail,
                rawPassword: rawPassword,
                isReturning: false
            });
        } catch (mailErr) {
            console.error("Mail sending failed for new student:", mailErr);
        }

        return res.status(201).json({ 
            success: true, 
            isReturning: false, 
            registrationId: newStudent.registrationId, 
            rawPassword 
        });

    } catch (error) {
        console.error("REGISTRATION_FLOW_ERROR:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};