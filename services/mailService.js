const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS 
    }
});

// Use named exports to avoid circular dependency issues
exports.sendRegistrationEmail = async (data) => {
    // Determine if returning based on the password placeholder
    const isReturning = data.rawPassword === "ALREADY_EXISTING" || data.isReturning;
    
    const mailOptions = {
        from: `"Expert Academy" <${process.env.EMAIL_USER}>`,
        to: data.email,
        subject: isReturning ? `Program Added: ${data.selectedCourse}` : `Welcome to ${data.selectedCourse}`,
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px;">
                <h2 style="color: #1A5F7A;">${isReturning ? 'Secondary Enrollment Confirmed' : 'Enrollment Confirmed'}</h2>
                <p>Dear ${data.name},</p>
                <p>You are now enrolled in: <strong>${data.selectedCourse}</strong></p>
                <div style="background: #f4f4f4; padding: 15px; border-radius: 10px;">
                    <p><strong>Registration ID:</strong> ${data.registrationId}</p>
                    <p><strong>Access Password:</strong> ${isReturning ? 'Use your existing portal password' : data.rawPassword}</p>
                </div>
                <p>Visit the portal to access your new curriculum.</p>
            </div>
        `
    };

    try {
        return await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error("Mail Error:", error);
        throw new Error("Failed to send welcome email");
    }
};