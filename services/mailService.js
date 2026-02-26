const nodemailer = require('nodemailer');

/**
 * CONFIGURATION: NODEMAILER TRANSPORTER
 * Uses Gmail App Password from Environment Variables
 */
const createTransporter = () => {
    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS // Ensure this is your 16-digit App Password
        }
    });
};

/**
 * 1. INQUIRY EMAIL (From Contact Page)
 * Sent to: Admin
 */
exports.sendInquiryEmail = async (data) => {
    const transporter = createTransporter();
    const mailOptions = {
        from: `"Academy Inquiries" <${process.env.EMAIL_USER}>`,
        to: 'expertcomputeracademypatna@gmail.com',
        subject: `New Inquiry: ${data.course} from ${data.name}`,
        html: `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; background-color: #f1f5f9;">
                <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 20px; padding: 30px; border: 1px solid #e2e8f0;">
                    <h2 style="color: #1A5F7A; border-bottom: 3px solid #F37021; padding-bottom: 10px; margin-bottom: 25px;">General Student Inquiry</h2>
                    <div style="line-height: 1.8; color: #334155;">
                        <p><strong>Student Name:</strong> ${data.name}</p>
                        <p><strong>Phone:</strong> ${data.phone}</p>
                        <p><strong>Email:</strong> ${data.email}</p>
                        <p><strong>Interested Course:</strong> ${data.course}</p>
                        <p style="background: #f8fafc; padding: 15px; border-radius: 10px; border-left: 4px solid #1A5F7A;"><strong>Message:</strong> ${data.message}</p>
                    </div>
                    <p style="font-size: 11px; color: #94a3b8; text-align: center; margin-top: 30px;">Expert Computer Academy Patna - Boring Road Crossing</p>
                </div>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        return { success: true };
    } catch (error) {
        console.error("Mail Service Error:", error);
        return { success: false };
    }
};

/**
 * 2. REGISTRATION EMAIL (From Enrollment Page)
 * This sends TWO emails: 
 * - One to the Student (Welcome & Login Details)
 * - One to the Admin (Full Documentation)
 */
exports.sendRegistrationEmail = async (data) => {
    const transporter = createTransporter();

    // --- A. STUDENT WELCOME EMAIL ---
    const studentMailOptions = {
        from: `"Expert Computer Academy" <${process.env.EMAIL_USER}>`,
        to: data.email, // Sent to student
        subject: `Welcome to ${data.selectedCourse} - Your Login Credentials`,
        html: `
            <div style="font-family: Arial, sans-serif; background-color: #f8fafc; padding: 40px;">
                <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 30px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);">
                    <div style="background-color: #1A5F7A; padding: 30px; text-align: center;">
                        <h1 style="color: white; margin: 0; font-size: 24px;">Enrollment Confirmed</h1>
                    </div>
                    <div style="padding: 40px;">
                        <p style="font-size: 16px; color: #475569;">Dear <strong>${data.name}</strong>,</p>
                        <p style="color: #475569;">Welcome to Expert Computer Academy. Your application for <strong>${data.selectedCourse}</strong> has been successfully recorded.</p>
                        
                        <div style="margin: 30px 0; padding: 25px; background-color: #f1f5f9; border-radius: 20px; border: 1px solid #e2e8f0;">
                            <p style="margin: 0 0 10px 0; font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: bold;">Login Registration ID</p>
                            <p style="margin: 0 0 20px 0; font-size: 18px; color: #1A5F7A; font-family: monospace;">${data.registrationId}</p>
                            
                            <p style="margin: 0 0 10px 0; font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: bold;">One-Time Password (OTP)</p>
                            <p style="margin: 0; font-size: 22px; color: #F37021; font-weight: bold; font-family: monospace;">${data.rawPassword}</p>
                        </div>

                        <p style="font-size: 13px; color: #64748b;">Please visit our centre at Boring Road Crossing to complete your document verification and fee payment.</p>
                        
                        <a href="https://your-academy-portal.com/login" style="display: inline-block; background-color: #1A5F7A; color: white; padding: 15px 30px; border-radius: 12px; text-decoration: none; font-weight: bold; margin-top: 20px;">Access Student Dashboard</a>
                    </div>
                </div>
            </div>
        `
    };

    // --- B. ADMIN NOTIFICATION EMAIL ---
    const adminMailOptions = {
        from: `"Portal Notification" <${process.env.EMAIL_USER}>`,
        to: 'expertcomputeracademypatna@gmail.com',
        subject: `CRITICAL: New Enrollment - ${data.name} [${data.selectedCourse}]`,
        html: `
            <div style="font-family: Arial, sans-serif; padding: 30px; background-color: #f8fafc;">
                <div style="background-color: white; padding: 40px; border-radius: 24px; border: 1px solid #e2e8f0;">
                    <h2 style="color: #1A5F7A; margin-bottom: 5px;">New Onboarding Record</h2>
                    <p style="color: #F37021; font-weight: bold; margin-bottom: 30px;">Program: ${data.selectedCourse}</p>
                    
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr><td style="padding: 10px 0; color: #64748b; font-size: 12px; text-transform: uppercase;">Registration ID</td><td style="font-weight: bold;">${data.registrationId}</td></tr>
                        <tr><td style="padding: 10px 0; color: #64748b; font-size: 12px; text-transform: uppercase;">Full Name</td><td style="font-weight: bold;">${data.name}</td></tr>
                        <tr><td style="padding: 10px 0; color: #64748b; font-size: 12px; text-transform: uppercase;">Contact</td><td style="font-weight: bold;">${data.phone}</td></tr>
                        <tr><td style="padding: 10px 0; color: #64748b; font-size: 12px; text-transform: uppercase;">Address</td><td style="font-weight: bold;">${data.address}</td></tr>
                    </table>

                    <h3 style="font-size: 14px; text-transform: uppercase; color: #1A5F7A; margin-top: 30px; border-bottom: 1px solid #eee;">Academic History</h3>
                    <p><strong>X Board:</strong> ${data.schoolBoard} (${data.schoolYear})</p>
                    <p><strong>Highest Qual:</strong> ${data.highestQualification}</p>
                    <p><strong>College/Univ:</strong> ${data.universityName}</p>
                    
                    <div style="margin-top: 40px; padding: 20px; background-color: #fff7ed; border-radius: 12px; font-size: 12px; color: #9a3412; border: 1px solid #ffedd5;">
                        Verification Required: This student has been assigned password <strong>${data.rawPassword}</strong>. 
                        Please ensure physical documents match the Aadhaar details submitted.
                    </div>
                </div>
            </div>
        `
    };

    try {
        // Send to both Student and Admin
        await Promise.all([
            transporter.sendMail(studentMailOptions),
            transporter.sendMail(adminMailOptions)
        ]);
        return { success: true };
    } catch (err) {
        console.error("Registration Mail System Error:", err);
        return { success: false };
    }
};