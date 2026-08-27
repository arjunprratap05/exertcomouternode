const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

// --- PRODUCTION VERCEL NODEMAILER CONFIG ---
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // Use SSL on port 465
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS 
    },
    // Force timeout closures so Vercel doesn't hang indefinitely 
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
});

// Helper: Map courses to PDF filenames
const getCourseEkitPath = (courseName) => {
    if (!courseName) return null;
    const normalizedName = courseName.toLowerCase();
    let fileName = null;

    if (normalizedName.includes('excel')) fileName = 'Advance_Excel_Welcome_E_Kit.pdf';
    else if (normalizedName.includes('tally')) fileName = 'Tally_Welcome_E_Kit.pdf';
    else if (normalizedName.includes('java')) fileName = 'Java_Welcome_E_Kit.pdf';
    else if (normalizedName.includes('generative ai') || normalizedName.includes('gen-ai')) fileName = 'Generative_AI_Welcome_E_Kit.pdf';
    else if (normalizedName.includes('dca') || normalizedName.includes('adca') || normalizedName.includes('diploma in computer')) fileName = 'ADCA_Welcome_E_Kit.pdf';
    else if (normalizedName.includes('full stack')) fileName = 'Full_Stack_Welcome_E_Kit.pdf';

    if (fileName) {
        return path.join(__dirname, '../ekits', fileName); 
    }
    return null;
};

exports.sendRegistrationEmail = async (data) => {
    const isReturning = data.rawPassword === "ALREADY_EXISTING" || data.isReturning;
    const ekitPath = getCourseEkitPath(data.selectedCourse);
    const attachments = [];

    // --- DYNAMIC PDF NAME REPLACEMENT (DRAW-OVER METHOD) ---
    if (ekitPath && fs.existsSync(ekitPath)) {
        try {
            // 1. Read the raw PDF file
            const existingPdfBytes = fs.readFileSync(ekitPath);
            const pdfDoc = await PDFDocument.load(existingPdfBytes);
            const helveticaFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
            
            // 2. Get Page 2
            const pages = pdfDoc.getPages();
            
            if (pages.length > 1) {
                const page2 = pages[1];
                const { height } = page2.getSize();

                // 3. CORRECTED COORDINATES
                // Shifted Y up from (height - 215) to (height - 142) to target the exact line
                const xPos = 48; // Left margin
                const yPos = height - 142; // Distance from bottom edge 

                // 4. Draw a wide white rectangle to completely hide "Dear studentNameField,"
                page2.drawRectangle({
                    x: xPos - 2,
                    y: yPos - 5,
                    width: 250, // Made wider to ensure the old text is fully erased
                    height: 25,
                    color: rgb(1, 1, 1), // White
                });

                // 5. Write the actual student's name seamlessly in its place
                page2.drawText(`Dear ${data.name},`, {
                    x: xPos,
                    y: yPos,
                    size: 13,
                    font: helveticaFont,
                    color: rgb(0, 0, 0), // Black
                });
            }

            // 6. Save modified PDF to memory
            const customPdfBytes = await pdfDoc.save();

            // 7. Attach the customized memory buffer to the email
            attachments.push({
                filename: `Welcome_E_Kit_${data.name.replace(/\s+/g, '_')}.pdf`, 
                content: Buffer.from(customPdfBytes),
                contentType: 'application/pdf'
            });

        } catch (pdfError) {
            console.error("PDF Customization Error. Sending original file as fallback:", pdfError);
            attachments.push({
                filename: path.basename(ekitPath),
                path: ekitPath,
                contentType: 'application/pdf'
            });
        }
    }

    // --- HTML EMAIL CONTENT ---
    const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-w: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
            <div style="background-color: #1A5F7A; padding: 30px; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-style: italic;">EXPERT COMPUTER ACADEMY</h1>
                <p style="color: #F37021; font-weight: bold; margin: 5px 0 0 0; font-size: 12px; text-transform: uppercase; letter-spacing: 2px;">Welcome to your future</p>
            </div>
            
            <div style="padding: 30px;">
                <h2 style="color: #1A5F7A; margin-top: 0;">${isReturning ? 'Secondary Enrollment Confirmed!' : 'Enrollment Confirmed!'}</h2>
                <p style="color: #475569; font-size: 16px;">Dear <strong>${data.name}</strong>,</p>
                <p style="color: #475569; font-size: 16px; line-height: 1.5;">You have been successfully enrolled in our <strong>${data.selectedCourse}</strong> program.</p>
                
                <div style="background-color: #f8fafc; border-left: 4px solid #F37021; padding: 20px; border-radius: 0 8px 8px 0; margin: 25px 0;">
                    <p style="margin: 0 0 10px 0; color: #64748b; font-size: 12px; text-transform: uppercase; font-weight: bold; letter-spacing: 1px;">Your Portal Credentials</p>
                    <p style="margin: 0 0 8px 0; color: #1e293b; font-size: 15px;"><strong>User ID:</strong> ${data.registrationId}</p>
                    <p style="margin: 0; color: #1e293b; font-size: 15px;">
                        <strong>Password:</strong> 
                        <span style="color: ${isReturning ? '#64748b' : '#e65100'}; font-family: monospace; font-size: 16px; background: #fff; padding: 2px 6px; border-radius: 4px; border: 1px solid #e2e8f0;">
                            ${isReturning ? 'Use your existing portal password' : data.rawPassword}
                        </span>
                    </p>
                </div>

                ${attachments.length > 0 ? `
                <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; padding: 15px; border-radius: 8px; margin-bottom: 25px;">
                    <p style="margin: 0; color: #065f46; font-size: 14px; font-weight: bold;">
                        📚 We have attached your Welcome E-Kit to this email! Please download and review it before your first class.
                    </p>
                </div>` : ''}
                
                <p style="color: #475569; font-size: 15px; line-height: 1.5;">Please log in to your student portal to access your live classes, assignments, and study materials.</p>
                
                <a href="https://expertcomputeracademy.in/student-login" style="display: inline-block; background-color: #F37021; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 30px; font-weight: bold; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; margin-top: 10px;">Access Student Portal</a>
            </div>
            
            <div style="background-color: #f1f5f9; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
                <p style="margin: 0; color: #94a3b8; font-size: 12px;">Kumar Tower, 2nd Floor, Boring Road crossing, Patna - 800001</p>
                <p style="margin: 5px 0 0 0; color: #94a3b8; font-size: 12px;">Support: +91 7282983335</p>
            </div>
        </div>
    `;

    const mailOptions = {
        from: `"Expert Academy" <${process.env.EMAIL_USER}>`,
        to: data.email,
        subject: isReturning ? `Program Added: ${data.selectedCourse}` : `Welcome to ${data.selectedCourse} - Credentials Inside`,
        html: htmlContent,
        attachments: attachments
    };

    try {
        return await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error("Mail Error:", error);
        throw new Error("Failed to send welcome email");
    }
};

exports.sendInquiryEmail = async (data) => {
    const mailOptions = {
        from: `"Expert Academy Leads" <${process.env.EMAIL_USER}>`,
        to: process.env.EMAIL_USER, 
        subject: `[${data.source.toUpperCase()}] New Lead: ${data.name}`,
        html: `
            <div style="font-family: sans-serif; border: 2px solid #1A5F7A; padding: 25px; border-radius: 15px;">
                <h2 style="color: #F37021; border-bottom: 1px solid #eee; padding-bottom: 10px;">${data.source} Lead Captured</h2>
                <p><strong>Name:</strong> ${data.name}</p>
                <p><strong>Phone:</strong> ${data.phone}</p>
                <p><strong>Email:</strong> ${data.email}</p>
                <p><strong>Course of Interest:</strong> ${data.course}</p>
                <p><strong>User Message:</strong> ${data.message || 'N/A'}</p>
                <div style="margin-top: 20px; padding: 10px; background: #f9f9f9; font-size: 11px;">
                    Generated on: ${new Date(data.createdAt).toLocaleString()}
                </div>
            </div>
        `
    };

    try {
        return await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error("Inquiry Mail Error:", error);
        throw new Error("Failed to send notification email");
    }
};