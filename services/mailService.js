const nodemailer = require('nodemailer');

const createTransporter = () => {
    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS // 16-digit App Password
        }
    });
};

/**
 * Handles general student inquiries from the Contact Page
 */
exports.sendInquiryEmail = async (data) => {
    const transporter = createTransporter();
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: 'arjun.pratap05@gmail.com', // 
        subject: `New Inquiry: ${data.course} from ${data.name}`,
        html: `
            <div style="font-family: sans-serif; padding: 30px; border: 1px solid #e2e8f0; border-radius: 20px; max-width: 600px;">
                <h2 style="color: #1A5F7A; border-bottom: 2px solid #F37021; padding-bottom: 10px;">General Student Inquiry</h2>
                <div style="margin-top: 20px; line-height: 1.6;">
                    <p><strong>Student Name:</strong> ${data.name}</p>
                    <p><strong>Phone:</strong> ${data.phone}</p>
                    <p><strong>Email:</strong> ${data.email}</p>
                    <p><strong>Interested Course:</strong> ${data.course}</p>
                    <p><strong>Message:</strong> ${data.message}</p>
                </div>
                <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
                <p style="font-size: 11px; color: #94a3b8; text-align: center;">Expert Computer Academy Patna - Boring Road Crossing</p>
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
 * Handles full student onboarding profiles from the Registration Page
 */
exports.sendRegistrationEmail = async (data) => {
    const transporter = createTransporter();
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: 'expertcomputeracademypatna@gmail.com', // 
        subject: `CRITICAL: New Student Registration - ${data.selectedCourse}`,
        html: `
            <div style="font-family: Arial, sans-serif; padding: 30px; background-color: #f8fafc;">
                <div style="background-color: white; padding: 40px; border-radius: 24px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
                    <h2 style="color: #1A5F7A; margin-bottom: 5px;">New Enrollment Profile</h2>
                    <p style="color: #F37021; font-weight: bold; margin-bottom: 30px;">Program: ${data.selectedCourse}</p>
                    
                    <h3 style="font-size: 14px; text-transform: uppercase; color: #64748b; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px;">01. Personal Details</h3>
                    <p><strong>Name:</strong> ${data.name}</p>
                    <p><strong>Mobile:</strong> ${data.phone}</p>
                    <p><strong>Email:</strong> ${data.email}</p>
                    <p><strong>Address:</strong> ${data.address}</p>

                    <h3 style="font-size: 14px; text-transform: uppercase; color: #64748b; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; margin-top: 30px;">02. Schooling (X / XII)</h3>
                    <p><strong>School Name:</strong> ${data.schoolName}</p>
                    <p><strong>Board:</strong> ${data.schoolBoard}</p>
                    <p><strong>Passing Date:</strong> ${data.schoolYear}</p>

                    <h3 style="font-size: 14px; text-transform: uppercase; color: #64748b; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; margin-top: 30px;">03. Higher Education</h3>
                    <p><strong>Highest Qualification:</strong> ${data.highestQualification}</p>
                    <p><strong>University/College:</strong> ${data.universityName}</p>
                    <p><strong>Completion Date:</strong> ${data.passingYear}</p>
                    
                    <div style="margin-top: 40px; padding: 20px; background-color: #f1f5f9; border-radius: 12px; font-size: 12px; color: #475569;">
                        This enrollment profile was generated via the official Expert Computer Academy onboarding portal. 
                        Please contact the student at <strong>${data.phone}</strong> for document verification at the Boring Road centre.
                    </div>
                </div>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        return { success: true };
    } catch (err) {
        console.error("Registration Mail Error:", err);
        return { success: false };
    }
};