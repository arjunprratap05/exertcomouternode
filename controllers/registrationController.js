const Student = require('../models/student');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { sendRegistrationEmail } = require('../services/mailService');

exports.handleRegistration = async (req, res) => {
    try {
        const { 
            name, fatherName, dob, email, phone, aadhaarNo, address,
            highSchoolBoard, interBoard, course 
        } = req.body;

        // 1. IDENTITY CHECK: Find existing student by Aadhaar (Identity Anchor)
        let student = await Student.findOne({ aadhaarNo });

        if (student) {
            // SCENARIO A: Already registered for THIS specific course?
            const alreadyEnrolled = student.enrollments.some(e => e.course === course);
            
            if (alreadyEnrolled) {
                return res.status(400).json({ 
                    success: false, 
                    message: "You are already registered with this course using this Aadhaar Card." 
                });
            }

            // SCENARIO B: Aadhaar match but NEW course (Secondary Enrollment)
            // Push new course into the database array to keep BOTH records
            student.enrollments.push({
                course: course,
                status: 'Applied',
                enrolledAt: new Date()
            });

            // Update primary course field for backward compatibility/quick sync
            student.course = course; 
            
            // Note: student.save() will now work because we removed 'next' from student.js model
            await student.save();

            // TRIGGER EMAIL SERVICE for returning student
            await sendRegistrationEmail({
                name: student.name,
                email: student.email,
                selectedCourse: course,
                registrationId: student.registrationId,
                rawPassword: "ALREADY_EXISTING", // Placeholder for mailer logic
                isReturning: true
            });

            return res.status(201).json({
                success: true,
                isReturning: true,
                registrationId: student.registrationId,
                message: "New course enrollment added to your existing profile!"
            });
        }

        // 2. NEW STUDENT SCENARIO (No Aadhaar Match)
        // Check if email exists to avoid registrationID conflicts
        const existingByEmail = await Student.findOne({ email: email.toLowerCase() });
        if (existingByEmail) {
            return res.status(400).json({ success: false, message: "This email is already linked to another Aadhaar." });
        }

        // 3. Security: Auto-generate Credentials for NEW human
        const rawPassword = crypto.randomBytes(4).toString('hex').toUpperCase(); 
        const hashedPassword = await bcrypt.hash(rawPassword, 12);

        // 4. Create New Human Record with initial Enrollment Array
        const newStudent = new Student({
            ...req.body,
            email: email.toLowerCase().trim(),
            password: hashedPassword,
            registrationId: email.toLowerCase().trim(),
            enrollments: [{ 
                course: course, 
                status: 'Applied' 
            }],
            studentImage: req.file ? {
                data: req.file.buffer,
                contentType: req.file.mimetype
            } : null
        });

        await newStudent.save();

        // 5. TRIGGER EMAIL SERVICE for new student
        await sendRegistrationEmail({
            name: newStudent.name,
            email: newStudent.email,
            selectedCourse: course,
            registrationId: newStudent.registrationId,
            rawPassword: rawPassword,
            isReturning: false
        });

        return res.status(201).json({
            success: true,
            isReturning: false,
            registrationId: newStudent.registrationId,
            rawPassword: rawPassword, 
            message: "Registration Completed. Welcome email sent!"
        });

    } catch (error) {
        console.error("Backend_Registration_Error:", error);
        return res.status(500).json({ 
            success: false, 
            message: "System Error: " + error.message 
        });
    }
};