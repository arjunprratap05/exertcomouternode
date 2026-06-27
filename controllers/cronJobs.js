const cron = require('node-cron');
const nodemailer = require('nodemailer');
const ExcelJS = require('exceljs'); // Added Excel library
const Student = require('../models/student'); // Update this path if needed

// Run every day at 23:50 (11:50 PM)
cron.schedule('50 23 * * *', async () => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // If tomorrow is the 1st, today is the last day of the month
    if (tomorrow.getDate() === 1) {
        console.log("Last day of the month detected. Compiling and dispatching automated Founder Report...");
        await compileAndSendAutomatedReport();
    }
});

async function compileAndSendAutomatedReport() {
    try {
        const now = new Date();
        const targetMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        // 1. Fetch all students from the DB
        const students = await Student.find({});
        
        let totalRevenue = 0;
        let pendingQueue = 0;
        const stats = {};

        // 2. Aggregate Data for Email Summary
        students.forEach(student => {
            if (student.discountRequest?.status === 'PENDING') {
                pendingQueue += 1;
            }

            let enrolls = student.enrollments && student.enrollments.length > 0 
                ? student.enrollments 
                : [];
                
            if (enrolls.length === 0 && student.course) {
                enrolls.push({
                    course: student.course,
                    amountPaid: student.amountPaid || 0,
                    enrolledAt: student.createdAt || student.date
                });
            }

            enrolls.forEach(en => {
                const amt = Number(en.amountPaid) || Number(student.amountPaid) || 0;
                totalRevenue += amt;

                if (en.course) {
                    if (!stats[en.course]) {
                        stats[en.course] = { enrollments: 0, revenue: 0 };
                    }
                    stats[en.course].enrollments += 1;
                    stats[en.course].revenue += amt;
                }
            });
        });

        const topCoursesData = Object.entries(stats)
            .map(([courseName, data]) => ({ courseName, ...data }))
            .sort((a, b) => b.enrollments - a.enrollments)
            .slice(0, 4);

        const coursesHtml = topCoursesData.map((c, i) => 
            `<li><strong>${i + 1}. ${c.courseName}</strong> - Enrolls: ${c.enrollments} | Revenue: ₹${c.revenue.toLocaleString()}</li>`
        ).join('');


        // --- 3. GENERATE FORMATTED EXCEL REPORT ---
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet(`Registry_${targetMonth}`);

        // Define Columns
        sheet.columns = [
            { header: 'Profile Identity', key: 'name', width: 25 },
            { header: 'Phone Number', key: 'phone', width: 15 },
            { header: 'Enrolled Program(s)', key: 'course', width: 40 },
            { header: 'Total Revenue (₹)', key: 'revenue', width: 18, style: { numFmt: '₹#,##0.00' } },
            { header: 'Portal Status', key: 'status', width: 15 },
            { header: 'Registration Date', key: 'date', width: 20 }
        ];

        // Format the Header Row (Blue background, White text)
        sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A5F7A' } };
        sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

        // Populate Data Rows
        students.forEach(student => {
            let coursesList = [];
            let studentTotalPaid = 0;

            const enrolls = student.enrollments && student.enrollments.length > 0 
                ? student.enrollments 
                : (student.course ? [{ course: student.course, amountPaid: student.amountPaid }] : []);

            enrolls.forEach(en => {
                if (en.course) coursesList.push(en.course);
                studentTotalPaid += (Number(en.amountPaid) || Number(student.amountPaid) || 0);
            });

            sheet.addRow({
                name: student.name || 'N/A',
                phone: student.phone || 'N/A',
                course: coursesList.join(', ') || 'General Enquiry',
                revenue: studentTotalPaid,
                status: student.isApproved ? 'ACTIVE' : 'INACTIVE',
                date: new Date(student.createdAt || student.date || Date.now()).toLocaleDateString()
            });
        });

        // Convert the Excel file to a Memory Buffer
        const buffer = await workbook.xlsx.writeBuffer();


        // --- 4. DISPATCH EMAIL WITH EXCEL ATTACHMENT ---
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER, 
                pass: process.env.EMAIL_PASS
            }
        });

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: process.env.FOUNDER_EMAILS, // Auto-sends to all comma-separated emails
            subject: `📊 Expert Academy Detailed Intelligence Report: ${targetMonth}`,
            html: `
                <div style="font-family: Arial, sans-serif; color: #1A5F7A; max-w: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                    <div style="background-color: #F37021; padding: 20px; text-align: center;">
                        <h2 style="color: white; margin: 0; font-style: italic;">EXPERT ACADEMY</h2>
                        <p style="color: rgba(255,255,255,0.8); margin: 5px 0 0; text-transform: uppercase; font-size: 12px; letter-spacing: 2px;">Automated Market Intelligence & Ledger</p>
                    </div>
                    
                    <div style="padding: 30px;">
                        <h3 style="border-bottom: 2px solid #f1f5f9; padding-bottom: 10px; margin-top: 0;">Period: ${targetMonth}</h3>
                        
                        <p>Dear Founder,</p>
                        <p>Please find the automated monthly intelligence summary below. <strong>A detailed, formatted Excel ledger containing full student records for this period is attached to this email.</strong></p>

                        <div style="display: flex; gap: 20px; margin-bottom: 30px; margin-top: 20px;">
                            <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; flex: 1;">
                                <p style="font-size: 10px; text-transform: uppercase; color: #64748b; margin: 0;">Monthly Revenue</p>
                                <p style="font-size: 24px; font-weight: bold; margin: 5px 0 0;">₹${totalRevenue.toLocaleString()}</p>
                            </div>
                            <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; flex: 1;">
                                <p style="font-size: 10px; text-transform: uppercase; color: #64748b; margin: 0;">Total Students</p>
                                <p style="font-size: 24px; font-weight: bold; margin: 5px 0 0;">${students.length}</p>
                            </div>
                        </div>

                        <h4 style="color: #F37021; text-transform: uppercase;">Top Performing Programs</h4>
                        <ul style="line-height: 1.8; color: #334155; background: #f8fafc; padding: 20px 40px; border-radius: 8px;">
                            ${coursesHtml || "<li>No course data generated for this period.</li>"}
                        </ul>
                        
                        <p style="font-size: 12px; color: #94a3b8; margin-top: 30px;">
                            Pending verification queues: <strong>${pendingQueue}</strong>.<br/>
                            Report generated automatically by the Server Engine.
                        </p>
                    </div>
                </div>
            `,
            attachments: [
                {
                    filename: `ExpertAcademy_Ledger_${targetMonth}.xlsx`,
                    content: buffer,
                    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                }
            ]
        };

        await transporter.sendMail(mailOptions);
        console.log("Detailed report with Excel attachment dispatched successfully.");

    } catch (error) {
        console.error("Automated Report Dispatch Error:", error);
    }
}