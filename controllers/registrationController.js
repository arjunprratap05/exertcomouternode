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

        // 1. DATA SANITIZATION (Fixes the NaN Error)
        let finalFee = Number(totalFee);
        if (isNaN(finalFee)) finalFee = 0;

        // 2. TRANSACTION ID / CASH SEQUENCE LOGIC
        let finalTransactionId = transactionId;

        if (paymentOption === 'CASH') {
            const fy = getFinancialYearSequence();
            // Increment sequence in DB atomically to prevent duplicates
            const counter = await Counter.findOneAndUpdate(
                { id: fy.dbKey },
                { $inc: { seq: 1 } },
                { new: true, upsert: true }
            );
            const sequenceNum = counter.seq.toString().padStart(3, '0');
            finalTransactionId = `ECA/CASH/${fy.label}/${sequenceNum}`;
        } else {
            // Check for duplicate UTR for Online Payments
            const existingUTR = await Student.findOne({ transactionId: finalTransactionId });
            if (existingUTR) {
                return res.status(400).json({ success: false, message: "This Transaction ID has already been used." });
            }
        }

        // 3. COUPON VERIFICATION
        let couponData = null;
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

                if (updatedCoupon) {
                    couponData = {
                        code: updatedCoupon.code,
                        discountValue: updatedCoupon.discountValue
                    };
                }
            } catch (e) { console.error("Coupon Parsing Error:", e); }
        }

        // 4. CHECK IF STUDENT EXISTS
        let student = await Student.findOne({ aadhaarNo });
        const rawPassword = crypto.randomBytes(4).toString('hex').toUpperCase();
        const hashedPassword = await bcrypt.hash(rawPassword, 12);
        const normalizedEmail = email.toLowerCase().trim();

        if (student) {
            // RETURNING STUDENT LOGIC
            const alreadyEnrolled = student.enrollments.some(e => e.course === course);
            if (alreadyEnrolled) {
                return res.status(400).json({ success: false, message: "Already registered for this course." });
            }

            student.enrollments.push({ course, enrolledAt: new Date(), status: 'Applied' });
            student.totalFee += finalFee; 
            student.paymentOption = paymentOption;
            student.transactionId = finalTransactionId;
            student.emiMonths = emiInterval || 1;
            
            if (couponData) student.appliedCoupon = couponData;
            await student.save();

            // TRIGGER MAIL
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

        // 5. NEW STUDENT LOGIC
        const newStudent = new Student({
            ...req.body,
            email: normalizedEmail,
            password: hashedPassword,
            registrationId: normalizedEmail, 
            totalFee: finalFee,
            appliedCoupon: couponData,
            paymentOption,
            transactionId: finalTransactionId,
            emiMonths: emiInterval || 1,
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
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};