const Student = require('../models/student');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { sendRegistrationEmail } = require('../services/mailService'); // 1. IMPORT YOUR MAILER

exports.handleRegistration = async (req, res) => {
    try {
        const { 
            name, fatherName, dob, email, phone, aadhaarNo, address,
            highSchoolBoard, interBoard, course 
        } = req.body;

        const highSchoolYear = parseInt(req.body.highSchoolYear);
        const highSchoolPercent = parseFloat(req.body.highSchoolPercent);
        const interYear = parseInt(req.body.interYear);
        const interPercent = parseFloat(req.body.interPercent);

        // 1. Check for existing student
        const existingStudent = await Student.findOne({ 
            $or: [{ email: email.toLowerCase() }, { aadhaarNo }] 
        });

        if (existingStudent) {
            return res.status(400).json({ 
                success: false, 
                message: "Student with this Email or Aadhaar already registered." 
            });
        }

        // 2. Security: Auto-generate Password
        const rawPassword = crypto.randomBytes(4).toString('hex').toUpperCase(); 
        const hashedPassword = await bcrypt.hash(rawPassword, 12);

        // 3. Create Student Object
        const newStudent = new Student({
            name,
            fatherName,
            dob,
            email: email.toLowerCase().trim(),
            phone,
            aadhaarNo,
            address,
            highSchoolBoard,
            highSchoolYear,
            highSchoolPercent,
            interBoard,
            interYear,
            interPercent,
            course,
            password: hashedPassword,
            registrationId: email.toLowerCase().trim(),
            studentImage: req.file ? {
                data: req.file.buffer,
                contentType: req.file.mimetype
            } : null, 
            status: 'Applied'
        });

        // 4. Save to MongoDB
        await newStudent.save();

        // 5. TRIGGER EMAIL SERVICE (New Logic)
        // We pass a combined object containing everything the mailer template needs
        await sendRegistrationEmail({
            name: newStudent.name,
            email: newStudent.email,
            selectedCourse: newStudent.course,
            registrationId: newStudent.registrationId,
            rawPassword: rawPassword, // Sending the unhashed password so student can see it
            phone: newStudent.phone,
            address: newStudent.address,
            schoolBoard: newStudent.highSchoolBoard,
            schoolYear: newStudent.highSchoolYear,
            highestQualification: "High School / Intermediate",
            universityName: newStudent.interBoard
        });

        // 6. Success Response
        return res.status(201).json({
            success: true,
            registrationId: newStudent.registrationId,
            rawPassword: rawPassword, 
            message: "Registration Completed. Welcome email sent!"
        });

    } catch (error) {
        console.error("Backend Error:", error);
        return res.status(500).json({ 
            success: false, 
            message: "Server Error: " + error.message 
        });
    }
};