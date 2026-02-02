const nodemailer = require('nodemailer');
const crypto = require('crypto');
const otpStore = new Map();

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS 
    }
});

exports.sendOTP = async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, msg: "Email required" });

    const currentTime = Date.now();
    let record = otpStore.get(email);

    if (record && record.requestCount >= 3 && record.expires > currentTime) {
        return res.status(429).json({ 
            success: false, 
            msg: "Maximum OTP limits reached for this email. Try again after 5 minutes." 
        });
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    otpStore.set(email, { 
        otp, 
        expires: currentTime + 300000, // 5 Mins
        requestCount: record ? record.requestCount + 1 : 1 
    });

    const mailOptions = {
        from: `"Expert Academy" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "OTP for Official Enrollment - Expert Computer Academy",
        html: `
            <div style="font-family: Arial, sans-serif; border: 1px solid #eee; padding: 20px; border-radius: 15px;">
                <h2 style="color: #1A5F7A;">Expert Computer Academy</h2>
                <p>Your OTP for student registration is:</p>
                <div style="background: #f4f4f4; padding: 15px; font-size: 28px; font-weight: bold; text-align: center; letter-spacing: 8px; color: #F37021;">
                    ${otp}
                </div>
                <p style="font-size: 12px; color: #777; margin-top: 20px;">Valid for 5 minutes. Attempt ${record ? record.requestCount + 1 : 1} of 3.</p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        res.status(200).json({ success: true, msg: "OTP Sent" });
    } catch (error) {
        res.status(500).json({ success: false, msg: "Email service failed" });
    }
};

exports.verifyOTP = (req, res) => {
    const { email, otp } = req.body;
    const record = otpStore.get(email);

    if (!record || record.expires < Date.now()) {
        return res.status(400).json({ success: false, msg: "OTP Expired" });
    }

    if (record.otp === otp) {
        otpStore.delete(email); // Verification success, reset count
        return res.status(200).json({ success: true, msg: "Verified" });
    }
    res.status(400).json({ success: false, msg: "Invalid OTP" });
};