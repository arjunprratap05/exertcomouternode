const nodemailer = require('nodemailer');
const ExcelJS = require('exceljs');
const Student = require('../models/student'); 
const Enquiry = require('../models/Inquiry'); 
const Coupon = require('../models/Coupon');    
const Batch = require('../models/Batch');     

exports.triggerMonthlyReport = async (req, res) => {
    try {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        if (tomorrow.getDate() !== 1) {
            console.log("Not the last day of the month. Skipped.");
            return res.status(200).json({ message: "Not the last day of the month. Skipped." });
        }

        console.log("Last day of the month detected. Compiling reports and dispatching dual emails...");
        
        const targetYear = today.getFullYear();
        const targetMonthNum = today.getMonth() + 1;
        const targetMonthKey = `${targetYear}-${String(targetMonthNum).padStart(2, '0')}`;
        
        const [students, enquiries, coupons, batches] = await Promise.all([
            Student.find({}),
            Enquiry.find({}),
            Coupon.find({}),
            Batch.find({ isActive: true })
        ]);
        
        let totalRevenue = 0;          // All-time gross collection
        let currentMonthRevenue = 0;   // Current month collection only
        let pendingQueue = 0;
        
        const statsAll = {};
        const statsCurrent = {};
        
        const currentMonthStudents = [];
        const currentMonthEnquiries = [];

        // 1. Process All-Time & Current Month Metrics
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

            let studentHasCurrentMonthEnrollment = false;

            enrolls.forEach(en => {
                const amt = Number(en.amountPaid) || Number(student.amountPaid) || 0;
                totalRevenue += amt;

                const enrollmentDate = new Date(en.enrolledAt || student.createdAt || student.date || Date.now());
                const enrollMonthKey = `${enrollmentDate.getFullYear()}-${String(enrollmentDate.getMonth() + 1).padStart(2, '0')}`;

                // Track Current Month Metrics
                if (enrollMonthKey === targetMonthKey) {
                    currentMonthRevenue += amt;
                    studentHasCurrentMonthEnrollment = true;

                    if (en.course) {
                        if (!statsCurrent[en.course]) {
                            statsCurrent[en.course] = { enrollments: 0, revenue: 0 };
                        }
                        statsCurrent[en.course].enrollments += 1;
                        statsCurrent[en.course].revenue += amt;
                    }
                }

                // Track All-Time Metrics
                if (en.course) {
                    if (!statsAll[en.course]) {
                        statsAll[en.course] = { enrollments: 0, revenue: 0 };
                    }
                    statsAll[en.course].enrollments += 1;
                    statsAll[en.course].revenue += amt;
                }
            });

            if (studentHasCurrentMonthEnrollment) {
                currentMonthStudents.push(student);
            }
        });

        enquiries.forEach(lead => {
            const leadDate = new Date(lead.createdAt || lead.date || Date.now());
            const leadMonthKey = `${leadDate.getFullYear()}-${String(leadDate.getMonth() + 1).padStart(2, '0')}`;
            if (leadMonthKey === targetMonthKey) {
                currentMonthEnquiries.push(lead);
            }
        });

        // Top Courses Data (Current Month vs All Time)
        const topCoursesCurrent = Object.entries(statsCurrent)
            .map(([courseName, data]) => ({ courseName, ...data }))
            .sort((a, b) => b.enrollments - a.enrollments)
            .slice(0, 4);

        const topCoursesAll = Object.entries(statsAll)
            .map(([courseName, data]) => ({ courseName, ...data }))
            .sort((a, b) => b.enrollments - a.enrollments)
            .slice(0, 4);

        const coursesCurrentHtml = topCoursesCurrent.map((c, i) => 
            `<li><strong>${i + 1}. ${c.courseName}</strong> - Enrolls: ${c.enrollments} | Revenue: ₹${c.revenue.toLocaleString()}</li>`
        ).join('');

        const coursesAllHtml = topCoursesAll.map((c, i) => 
            `<li><strong>${i + 1}. ${c.courseName}</strong> - Enrolls: ${c.enrollments} | Revenue: ₹${c.revenue.toLocaleString()}</li>`
        ).join('');

        // Helper for Excel styling
        const styleHeaderRow = (sheet) => {
            sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
            sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A5F7A' } };
            sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
        };

        // ==========================================
        // WORKBOOK 1: CURRENT MONTH REPORT
        // ==========================================
        const wbCurrent = new ExcelJS.Workbook();
        const sheetCurrentReg = wbCurrent.addWorksheet('Current Month Registrations');
        sheetCurrentReg.columns = [
            { header: 'Profile Identity', key: 'name', width: 25 },
            { header: 'Phone Number', key: 'phone', width: 15 },
            { header: 'Enrolled Program(s)', key: 'course', width: 40 },
            { header: 'Collection (₹)', key: 'revenue', width: 18, style: { numFmt: '₹#,##0.00' } },
            { header: 'Portal Status', key: 'status', width: 15 },
            { header: 'Registration Date', key: 'date', width: 20 }
        ];
        styleHeaderRow(sheetCurrentReg);

        currentMonthStudents.forEach(student => {
            let coursesList = [];
            let studentMonthPaid = 0;
            const enrolls = student.enrollments && student.enrollments.length > 0 
                ? student.enrollments : (student.course ? [{ course: student.course, amountPaid: student.amountPaid, enrolledAt: student.createdAt }] : []);

            enrolls.forEach(en => {
                const enrollmentDate = new Date(en.enrolledAt || student.createdAt || Date.now());
                const enrollMonthKey = `${enrollmentDate.getFullYear()}-${String(enrollmentDate.getMonth() + 1).padStart(2, '0')}`;
                if (enrollMonthKey === targetMonthKey) {
                    if (en.course) coursesList.push(en.course);
                    studentMonthPaid += (Number(en.amountPaid) || Number(student.amountPaid) || 0);
                }
            });

            sheetCurrentReg.addRow({
                name: student.name || 'N/A',
                phone: student.phone || 'N/A',
                course: coursesList.join(', ') || 'General Enquiry',
                revenue: studentMonthPaid,
                status: student.isApproved ? 'ACTIVE' : 'INACTIVE',
                date: new Date(student.createdAt || student.date || Date.now()).toLocaleDateString()
            });
        });

        const bufferCurrent = await wbCurrent.xlsx.writeBuffer();

        // ==========================================
        // WORKBOOK 2: MASTER LEDGER (ALL TIME)
        // ==========================================
        const wbMaster = new ExcelJS.Workbook();
        
        const sheetRegistry = wbMaster.addWorksheet('All Registrations');
        sheetRegistry.columns = [
            { header: 'Profile Identity', key: 'name', width: 25 },
            { header: 'Phone Number', key: 'phone', width: 15 },
            { header: 'Enrolled Program(s)', key: 'course', width: 40 },
            { header: 'Total Revenue (₹)', key: 'revenue', width: 18, style: { numFmt: '₹#,##0.00' } },
            { header: 'Portal Status', key: 'status', width: 15 },
            { header: 'Registration Date', key: 'date', width: 20 }
        ];
        styleHeaderRow(sheetRegistry);

        students.forEach(student => {
            let coursesList = [];
            let studentTotalPaid = 0;
            const enrolls = student.enrollments && student.enrollments.length > 0 
                ? student.enrollments : (student.course ? [{ course: student.course, amountPaid: student.amountPaid }] : []);

            enrolls.forEach(en => {
                if (en.course) coursesList.push(en.course);
                studentTotalPaid += (Number(en.amountPaid) || Number(student.amountPaid) || 0);
            });

            sheetRegistry.addRow({
                name: student.name || 'N/A',
                phone: student.phone || 'N/A',
                course: coursesList.join(', ') || 'General Enquiry',
                revenue: studentTotalPaid,
                status: student.isApproved ? 'ACTIVE' : 'INACTIVE',
                date: new Date(student.createdAt || student.date || Date.now()).toLocaleDateString()
            });
        });

        const sheetLeads = wbMaster.addWorksheet('Web Leads');
        sheetLeads.columns = [
            { header: 'Lead Identity', key: 'name', width: 25 },
            { header: 'Phone Number', key: 'phone', width: 15 },
            { header: 'Program Interest', key: 'course', width: 30 },
            { header: 'Lead Source', key: 'source', width: 20 },
            { header: 'Contact Status', key: 'status', width: 15 },
            { header: 'Enquiry Date', key: 'date', width: 20 }
        ];
        styleHeaderRow(sheetLeads);

        enquiries.forEach(lead => {
            sheetLeads.addRow({
                name: lead.name || 'N/A',
                phone: lead.phone || 'N/A',
                course: lead.course || 'GENERAL',
                source: lead.source || 'Website',
                status: lead.isContacted ? 'CONTACTED' : 'PENDING',
                date: new Date(lead.createdAt || lead.date || Date.now()).toLocaleDateString()
            });
        });

        const sheetCoupons = wbMaster.addWorksheet('Coupons');
        sheetCoupons.columns = [
            { header: 'Campaign Narrative', key: 'desc', width: 40 },
            { header: 'Activation Code', key: 'code', width: 20 },
            { header: 'Target Scope', key: 'scope', width: 20 },
            { header: 'Benefit Value', key: 'benefit', width: 15 },
            { header: 'Usage Metrics', key: 'usage', width: 15 },
            { header: 'System Status', key: 'status', width: 15 },
            { header: 'Expiry Date', key: 'expiry', width: 20 }
        ];
        styleHeaderRow(sheetCoupons);

        coupons.forEach(coupon => {
            sheetCoupons.addRow({
                desc: coupon.description || 'N/A',
                code: coupon.code,
                scope: coupon.courseCode,
                benefit: coupon.discountType === 'FLAT' ? `₹${coupon.discountValue}` : `${coupon.discountValue}%`,
                usage: `${coupon.usedCount || 0} / ${coupon.maxUsage}`,
                status: coupon.isActive ? 'ACTIVE' : 'EXPIRED',
                expiry: new Date(coupon.validTo).toLocaleDateString()
            });
        });

        const sheetBatches = wbMaster.addWorksheet('Active Batches');
        sheetBatches.columns = [
            { header: 'Batch Code', key: 'code', width: 20 },
            { header: 'Assigned Program', key: 'course', width: 40 },
            { header: 'Instructor', key: 'instructor', width: 25 },
            { header: 'Broadcast Schedule', key: 'schedule', width: 20 }
        ];
        styleHeaderRow(sheetBatches);

        batches.forEach(batch => {
            sheetBatches.addRow({
                code: batch.batchCode,
                course: batch.courseName || batch.courseId?.replace(/-/g, ' ') || 'N/A',
                instructor: batch.instructor || 'Instructor TBD',
                schedule: batch.startTime || 'TBD'
            });
        });

        const bufferMaster = await wbMaster.xlsx.writeBuffer();

        // ==========================================
        // DISPATCH TWO EMAILS VIA NODEMAILER
        // ==========================================
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER, 
                pass: process.env.EMAIL_PASS
            }
        });

        // Email 1: Current Month Report
        const mailOptionsCurrent = {
            from: process.env.EMAIL_USER,
            to: process.env.FOUNDER_EMAILS,
            subject: `📈 Expert Academy Current Month Report: ${targetMonthKey}`,
            html: `
                <div style="font-family: Arial, sans-serif; color: #1A5F7A; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                    <div style="background-color: #F37021; padding: 20px; text-align: center;">
                        <h2 style="color: white; margin: 0; font-style: italic;">EXPERT ACADEMY</h2>
                        <p style="color: rgba(255,255,255,0.8); margin: 5px 0 0; text-transform: uppercase; font-size: 12px; letter-spacing: 2px;">Current Month Performance Summary</p>
                    </div>
                    
                    <div style="padding: 30px;">
                        <h3 style="border-bottom: 2px solid #f1f5f9; padding-bottom: 10px; margin-top: 0;">Period: ${targetMonthKey}</h3>
                        
                        <p>Dear Founder,</p>
                        <p>Here is the focused performance summary for <strong>${targetMonthKey}</strong>. The attachment contains records registered exclusively during this billing cycle.</p>

                        <div style="display: flex; gap: 20px; margin-bottom: 30px; margin-top: 20px;">
                            <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; flex: 1;">
                                <p style="font-size: 10px; text-transform: uppercase; color: #64748b; margin: 0;">Current Month Collection</p>
                                <p style="font-size: 24px; font-weight: bold; margin: 5px 0 0; color: #F37021;">₹${currentMonthRevenue.toLocaleString()}</p>
                            </div>
                            <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; flex: 1;">
                                <p style="font-size: 10px; text-transform: uppercase; color: #64748b; margin: 0;">All-Time Gross Revenue</p>
                                <p style="font-size: 24px; font-weight: bold; margin: 5px 0 0; color: #1A5F7A;">₹${totalRevenue.toLocaleString()}</p>
                            </div>
                        </div>

                        <h4 style="color: #F37021; text-transform: uppercase;">Top Performing Programs This Month</h4>
                        <ul style="line-height: 1.8; color: #334155; background: #f8fafc; padding: 20px 40px; border-radius: 8px;">
                            ${coursesCurrentHtml || "<li>No course data recorded for this month.</li>"}
                        </ul>
                        
                        <p style="font-size: 12px; color: #94a3b8; margin-top: 30px;">
                            New Leads Captured This Month: <strong>${currentMonthEnquiries.length}</strong>.<br/>
                            Report generated automatically by the Server Engine.
                        </p>
                    </div>
                </div>
            `,
            attachments: [
                {
                    filename: `ExpertAcademy_CurrentMonth_${targetMonthKey}.xlsx`,
                    content: bufferCurrent,
                    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                }
            ]
        };

        // Email 2: Master Ledger Report (All-Time Collections & Data)
        const mailOptionsMaster = {
            from: process.env.EMAIL_USER,
            to: process.env.FOUNDER_EMAILS,
            subject: `📊 Expert Academy Master Data Ledger (All-Time): ${targetMonthKey}`,
            html: `
                <div style="font-family: Arial, sans-serif; color: #1A5F7A; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                    <div style="background-color: #1A5F7A; padding: 20px; text-align: center;">
                        <h2 style="color: white; margin: 0; font-style: italic;">EXPERT ACADEMY</h2>
                        <p style="color: rgba(255,255,255,0.8); margin: 5px 0 0; text-transform: uppercase; font-size: 12px; letter-spacing: 2px;">Master Ledger & All-Time Intelligence</p>
                    </div>
                    
                    <div style="padding: 30px;">
                        <h3 style="border-bottom: 2px solid #f1f5f9; padding-bottom: 10px; margin-top: 0;">Cumulative Data as of ${targetMonthKey}</h3>
                        
                        <p>Dear Founder,</p>
                        <p>Please find the complete historical overview below. <strong>The attached master ledger contains all-time multi-sheet records for Registrations, Web Leads, Coupons, and Active Batches.</strong></p>

                        <div style="display: flex; gap: 20px; margin-bottom: 30px; margin-top: 20px;">
                            <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; flex: 1;">
                                <p style="font-size: 10px; text-transform: uppercase; color: #64748b; margin: 0;">Gross Collection (All-Time)</p>
                                <p style="font-size: 24px; font-weight: bold; margin: 5px 0 0;">₹${totalRevenue.toLocaleString()}</p>
                            </div>
                            <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; flex: 1;">
                                <p style="font-size: 10px; text-transform: uppercase; color: #64748b; margin: 0;">Total Registered Students</p>
                                <p style="font-size: 24px; font-weight: bold; margin: 5px 0 0;">${students.length}</p>
                            </div>
                        </div>

                        <h4 style="color: #F37021; text-transform: uppercase;">Top Programs (All-Time Volume)</h4>
                        <ul style="line-height: 1.8; color: #334155; background: #f8fafc; padding: 20px 40px; border-radius: 8px;">
                            ${coursesAllHtml || "<li>No course data generated.</li>"}
                        </ul>
                        
                        <p style="font-size: 12px; color: #94a3b8; margin-top: 30px;">
                            Pending verification queues: <strong>${pendingQueue}</strong>.<br/>
                            Total All-Time Leads Captured: <strong>${enquiries.length}</strong>.<br/>
                            Report generated automatically by the Server Engine.
                        </p>
                    </div>
                </div>
            `,
            attachments: [
                {
                    filename: `ExpertAcademy_MasterLedger_AllTime_${targetMonthKey}.xlsx`,
                    content: bufferMaster,
                    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                }
            ]
        };

        // Send both emails sequentially
        await transporter.sendMail(mailOptionsCurrent);
        console.log("Current month report email dispatched successfully.");

        await transporter.sendMail(mailOptionsMaster);
        console.log("Master ledger all-time report email dispatched successfully.");
        
        return res.status(200).json({ success: true, message: "Both Automated Reports Sent Successfully" });

    } catch (error) {
        console.error("Automated Report Dispatch Error:", error);
        return res.status(500).json({ success: false, error: error.message });
    }
};