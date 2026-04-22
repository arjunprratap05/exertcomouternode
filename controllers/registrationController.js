const Student = require('../models/student');
const Coupon = require('../models/Coupon');
const Counter = require('../models/Counter');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { getFinancialYearSequence } = require('../utils/fyHelper');
const { sendRegistrationEmail } = require('../services/mailService');

exports.handleRegistration = async (req, res) => {
    try {
        const { 
            name, email, aadhaarNo, course, totalFee, 
            appliedCoupon, paymentOption, transactionId, emiInterval 
        } = req.body;

        // 1. DATA SANITIZATION
        let finalFee = Number(totalFee) || 0;
        let finalTransactionId = transactionId;
        const normalizedEmail = email.toLowerCase().trim();

        // 2. TRANSACTION ID LOGIC
        if (paymentOption === 'CASH') {
            const fy = getFinancialYearSequence();
            const counter = await Counter.findOneAndUpdate(
                { id: fy.dbKey },
                { $inc: { seq: 1 } },
                { new: true, upsert: true }
            );
            finalTransactionId = `ECA/CASH/${fy.label}/${counter.seq.toString().padStart(3, '0')}`;
        } else {
            // GLOBAL UTR CHECK (Ensures UTR is unique across all students and all courses)
            const existingUTR = await Student.findOne({ "enrollments.transactionId": finalTransactionId });
            if (existingUTR) {
                return res.status(400).json({ 
                    success: false, 
                    message: "This Transaction ID has already been used for another course." 
                });
            }
        }

        // 3. COUPON VERIFICATION (Atomic Update)
        let couponData = null;
        if (appliedCoupon) {
            try {
                const parsedCoupon = typeof appliedCoupon === 'string' ? JSON.parse(appliedCoupon) : appliedCoupon;
                const updatedCoupon = await Coupon.findOneAndUpdate(
                    { 
                        code: parsedCoupon.code.toUpperCase(), 
                        isActive: true,
                        $expr: { $lt: ["$usedCount", "$maxUsage"] } 
                    },
                    { $inc: { usedCount: 1 } },
                    { new: true }
                );
                if (updatedCoupon) {
                    couponData = { code: updatedCoupon.code, discountValue: updatedCoupon.discountValue };
                }
            } catch (e) { console.error("Coupon Processing Error:", e); }
        }

        // 4. FIND STUDENT BY AADHAAR
        let student = await Student.findOne({ aadhaarNo });

        if (student) {
            // --- RETURNING STUDENT LOGIC ---
            const alreadyEnrolled = student.enrollments.some(e => e.course === course);
            if (alreadyEnrolled) {
                return res.status(400).json({ success: false, message: "You are already registered for this course." });
            }

            // Push New Enrollment Object
            const newEnrollment = {
                course,
                courseFee: finalFee,
                paymentOption,
                transactionId: finalTransactionId,
                emiMonths: emiInterval || 1,
                appliedCoupon: couponData,
                status: 'Applied'
            };

            student.enrollments.push(newEnrollment);
            await student.save();

            // Notify via Mail
            try {
                await sendRegistrationEmail({
                    email: student.email,
                    name: student.name,
                    selectedCourse: course,
                    registrationId: student.registrationId,
                    isReturning: true,
                    transactionId: finalTransactionId
                });
            } catch (mErr) { console.error("Mail Error:", mErr); }

            return res.status(201).json({ 
                success: true, 
                isReturning: true, 
                registrationId: student.registrationId,
                transactionId: finalTransactionId 
            });
        }

        // --- NEW STUDENT LOGIC ---
        const rawPassword = crypto.randomBytes(4).toString('hex').toUpperCase();
        const hashedPassword = await bcrypt.hash(rawPassword, 12);

        const newStudent = new Student({
            ...req.body,
            email: normalizedEmail,
            password: hashedPassword,
            registrationId: normalizedEmail, 
            enrollments: [{
                course,
                courseFee: finalFee,
                paymentOption,
                transactionId: finalTransactionId,
                emiMonths: emiInterval || 1,
                appliedCoupon: couponData,
                status: 'Applied'
            }]
        });

        await newStudent.save();

        // Notify via Mail
        try {
            await sendRegistrationEmail({
                email: normalizedEmail,
                name: name,
                selectedCourse: course,
                registrationId: normalizedEmail,
                rawPassword: rawPassword,
                isReturning: false,
                transactionId: finalTransactionId
            });
        } catch (mErr) { console.error("Mail Error:", mErr); }

        return res.status(201).json({ 
            success: true, 
            isReturning: false, 
            registrationId: newStudent.registrationId, 
            rawPassword,
            transactionId: finalTransactionId
        });

    } catch (error) {
        console.error("REGISTRATION_FLOW_ERROR:", error);
        res.status(500).json({ success: false, message: "Critical Server Error" });
    }
};