const Student = require('../models/student');
const { sendRegistrationEmail } = require('../services/mailService');

exports.handleRegistration = async (req, res) => {
    try {
        // 1. Prepare data from the React form and Multer file upload
        const studentData = {
            ...req.body,
            studentImage: req.file ? req.file.path : null
        };

        // 2. Step One: Attempt to save to MongoDB
        const newStudent = new Student(studentData);
        const savedStudent = await newStudent.save(); // Execution pauses here until DB confirms

        // 3. Step Two: Only execute if Step One succeeded
        console.log(`✅ Data secured for ${savedStudent.name}. Now shooting email...`);
        
        const emailResult = await sendRegistrationEmail({
            ...req.body,
            selectedCourse: req.body.course,
            schoolName: req.body.highSchoolBoard,
            schoolBoard: req.body.highSchoolBoard,
            schoolYear: req.body.highSchoolYear,
            highestQualification: "10th/12th Entry",
            universityName: req.body.interBoard,
            passingYear: req.body.interYear
        });

        // 4. Send final response to React frontend
        res.status(200).json({ 
            success: true, 
            message: "Registration saved and email dispatched!",
            studentId: savedStudent._id,
            emailSent: emailResult.success
        });

    } catch (err) {
        // If MongoDB fails (e.g., duplicate Aadhaar), this block runs
        // and NO email is sent.
        console.error("❌ Database Save Failed. Email aborted.", err);
        res.status(500).json({ 
            success: false, 
            message: "Database error: Registration not processed." 
        });
    }
};