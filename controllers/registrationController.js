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
            amountPaid, appliedCoupon, paymentOption, transactionId, emiInterval
        } = req.body;

        let netPayableFee = Number(totalFee) || 0; 
        let cashOrDigitalPaid = Number(amountPaid) || 0;
        let finalTransactionId = transactionId;
        const normalizedEmail = email.toLowerCase().trim();

        if (paymentOption === 'CASH') {
            const fy = getFinancialYearSequence();
            const counter = await Counter.findOneAndUpdate(
                { id: fy.dbKey },
                { $inc: { seq: 1 } },
                { new: true, upsert: true }
            );
            finalTransactionId = `ECA/CASH/${fy.label}/${counter.seq.toString().padStart(3, '0')}`;
        } else {
            const existingUTR = await Student.findOne({ "enrollments.transactionId": finalTransactionId });
            if (existingUTR) {
                return res.status(400).json({ 
                    success: false, 
                    message: "This Transaction ID has already been used for another course." 
                });
            }
        }

        let determinedStatus = "PENDING";
        if (cashOrDigitalPaid > 0) {
            determinedStatus = cashOrDigitalPaid >= netPayableFee ? "PAID" : "PARTIALLY_PAID";
        }

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

        const enrollmentCard = {
            course,
            courseFee: netPayableFee,      
            amountPaid: cashOrDigitalPaid, 
            paymentOption,
            transactionId: finalTransactionId,
            emiMonths: emiInterval || 1,
            appliedCoupon: couponData,
            paymentStatus: determinedStatus,
            status: 'Applied',
            enrolledAt: new Date()
        };

        let student = await Student.findOne({ aadhaarNo });

        if (student) {
            const alreadyEnrolled = student.enrollments.some(e => e.course === course);
            if (alreadyEnrolled) {
                return res.status(400).json({ success: false, message: "You are already registered for this course." });
            }

            // Dual Sync: Push into array list AND override root trackers with the latest course snapshot
            student.enrollments.push(enrollmentCard);
            
            student.course = course;
            student.totalFee = netPayableFee;
            student.amountPaid = cashOrDigitalPaid;
            student.paymentOption = paymentOption;
            student.transactionId = finalTransactionId;
            student.leadStatus = 'Applicant';

            await student.save();

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

            return res.status(201).json({ success: true, isReturning: true, registrationId: student.registrationId });
        }

        // --- NEW STUDENT PROFILE WRITES BOTH FIELDS SIMULTANEOUSLY ---
        const rawPassword = crypto.randomBytes(4).toString('hex').toUpperCase();
        const hashedPassword = await bcrypt.hash(rawPassword, 12);

        const newStudent = new Student({
            ...req.body,
            email: normalizedEmail,
            password: hashedPassword,
            registrationId: normalizedEmail, 
            
            // Legacy Root System Sync
            course,
            totalFee: netPayableFee,
            amountPaid: cashOrDigitalPaid,
            paymentOption,
            transactionId: finalTransactionId,
            leadStatus: 'Applicant',
            
            // New Array System Sync
            enrollments: [enrollmentCard]
        });

        await newStudent.save();

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

        return res.status(201).json({ success: true, isReturning: false, rawPassword, registrationId: newStudent.registrationId });

    } catch (error) {
        console.error("REGISTRATION_FLOW_ERROR:", error);
        res.status(500).json({ success: false, message: "Critical Server Error" });
    }
};