const Attendance = require('../models/Attendance');
const Leave = require('../models/Leave');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Helper to filter dates
const getDateFilter = (startDate, endDate, dateField = 'createdAt') => {
  let filter = {};
  if (startDate || endDate) {
    filter[dateField] = {};
    if (startDate) filter[dateField].$gte = new Date(startDate);
    if (endDate) {
      let end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filter[dateField].$lte = end;
    }
  }
  return filter;
};

// @desc    Get aggregated report data for dashboard
// @route   GET /api/reports/analytics
// @access  Private (Admin)
exports.getAnalytics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const attendanceFilter = getDateFilter(startDate, endDate, 'date');
    const leaveFilter = getDateFilter(startDate, endDate, 'createdAt');

    const attendanceStats = await Attendance.aggregate([
      { $match: attendanceFilter },
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);

    const leaveStats = await Leave.aggregate([
      { $match: leaveFilter },
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        attendance: attendanceStats.map(a => ({ name: a._id, value: a.count })),
        leaves: leaveStats.map(l => ({ name: l._id, value: l.count }))
      }
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Download CSV Report
// @route   GET /api/reports/download/csv
// @access  Private (Admin)
exports.downloadCSV = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const leaveFilter = getDateFilter(startDate, endDate, 'createdAt');

    const leaves = await Leave.find(leaveFilter).populate('userId', 'name email');
    
    let csv = 'Employee Name,Email,From Date,To Date,Status,Reason\n';
    leaves.forEach(l => {
      const name = l.userId?.name || 'N/A';
      const email = l.userId?.email || 'N/A';
      const from = new Date(l.fromDate).toLocaleDateString();
      const to = new Date(l.toDate).toLocaleDateString();
      const reason = (l.reason || '').replace(/,/g, ' '); // escape commas
      csv += `${name},${email},${from},${to},${l.status},${reason}\n`;
    });

    res.header('Content-Type', 'text/csv');
    res.attachment(`leave_report_${Date.now()}.csv`);
    return res.send(csv);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Download PDF Report
// @route   GET /api/reports/download/pdf
// @access  Private (Admin)
exports.downloadPDF = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const leaveFilter = getDateFilter(startDate, endDate, 'createdAt');

    const leaves = await Leave.find(leaveFilter).populate('userId', 'name email');

    let rowsHtml = '';
    leaves.forEach(l => {
      rowsHtml += `
        <tr>
          <td>${l.userId?.name || 'N/A'}</td>
          <td>${new Date(l.fromDate).toLocaleDateString()} to ${new Date(l.toDate).toLocaleDateString()}</td>
          <td>${l.status}</td>
        </tr>
      `;
    });

    const htmlContent = `
      <html>
        <head>
          <style>
             body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #333; }
             h1 { color: #1e3a8a; border-bottom: 2px solid #1e3a8a; padding-bottom: 10px; }
             table { width: 100%; border-collapse: collapse; margin-top: 20px; }
             th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
             th { background-color: #f3f4f6; color: #374151; }
          </style>
        </head>
        <body>
          <h1>Official Leave Activity Report</h1>
          <p>Generated on: ${new Date().toLocaleString()}</p>
          <p>Filters: ${startDate || 'Beginning of time'} to ${endDate || 'Present'}</p>
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Dates</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </body>
      </html>
    `;

    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    
    // Create temp directory safely
    const tempDir = path.join(__dirname, '..', 'temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
    
    const filePath = path.join(tempDir, `report_${Date.now()}.pdf`);
    await page.pdf({ path: filePath, format: 'A4', printBackground: true });
    
    await browser.close();

    res.download(filePath, 'Analytical_Report.pdf', (err) => {
      if (err) {
        console.error('downloadPDF error:', err);
      }

      if (fs.existsSync(filePath)) {
        fs.unlink(filePath, (unlinkError) => {
          if (unlinkError) {
            console.error('downloadPDF cleanup error:', unlinkError);
          }
        });
      }
    });

  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
