const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Employee = require('../models/Employee');
const Document = require('../models/Document');
const User = require('../models/User');
const { encryptText, decryptText } = require('../utils/documentCrypto');

const uploadsRoot = path.join(__dirname, '..', 'uploads');
const secureDocumentsRoot = path.join(__dirname, '..', 'uploads', 'documents');

const ensureDir = (targetPath) => {
  if (!fs.existsSync(targetPath)) {
    fs.mkdirSync(targetPath, { recursive: true });
  }
};

ensureDir(uploadsRoot);
ensureDir(secureDocumentsRoot);

const getSafeRelativeFileUrl = (fileUrl) => {
  const normalized = String(fileUrl || '').replace(/^\/+/, '').replace(/\//g, path.sep);
  return path.join(__dirname, '..', normalized);
};

const resolveEmployeeUserId = async (req, employeeIdFromBody) => {
  if (req.user.role === 'admin') {
    if (!employeeIdFromBody || !mongoose.Types.ObjectId.isValid(employeeIdFromBody)) {
      throw new Error('Valid employeeId is required');
    }

    const employeeUser = await User.findById(employeeIdFromBody).select('_id role email name');
    if (!employeeUser) {
      throw new Error('Employee user not found');
    }

    return employeeUser;
  }

  return req.user;
};

const canAccessEmployeeDocuments = (requestUser, employeeId) => (
  requestUser.role === 'admin' || String(requestUser._id) === String(employeeId)
);

const serializeDocument = (document, req) => {
  const record = typeof document.toObject === 'function' ? document.toObject() : document;
  return {
    _id: record._id,
    employeeId: record.employeeId,
    documentType: record.documentType,
    displayName: record.displayName,
    originalName: decryptText(record.originalNameEncrypted),
    uploadedBy: record.uploadedBy,
    uploadedByRole: record.uploadedByRole,
    mimeType: record.mimeType,
    fileSize: record.fileSize,
    status: record.status,
    createdAt: record.createdAt,
    previewUrl: `/api/documents/preview/${record._id}`,
    downloadUrl: `/api/documents/download/${record._id}`,
    canDelete: req.user.role === 'admin' || String(req.user._id) === String(record.employeeId)
  };
};

const buildOfferLetterHtml = ({
  employeeName,
  firstName,
  employeeRole,
  departmentName,
  formattedJoiningDate,
  formattedSalary,
  hrName
}) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    @page { size: A4; margin: 14mm 14mm 16mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Arial, Helvetica, sans-serif;
      color: #1f2937;
      font-size: 10.4px;
      line-height: 1.34;
    }
    .page { min-height: 100%; }
    .letterhead {
      border-bottom: 1.6px solid #0f172a;
      padding-bottom: 10px;
      margin-bottom: 12px;
      text-align: center;
    }
    .letterhead h1 {
      margin: 0;
      font-size: 21px;
      letter-spacing: 0.7px;
      color: #0f172a;
    }
    .letterhead p {
      margin: 3px 0 0;
      font-size: 10px;
      color: #475569;
    }
    .meta {
      display: table;
      width: 100%;
      margin-bottom: 12px;
      font-size: 10.2px;
    }
    .meta-row { display: table-row; }
    .meta-cell {
      display: table-cell;
      width: 50%;
      padding: 0 0 2px;
      vertical-align: top;
    }
    .meta-right { text-align: right; }
    .recipient { margin-bottom: 10px; }
    .recipient-name {
      font-size: 12.2px;
      font-weight: 700;
      color: #111827;
      margin: 3px 0 1px;
    }
    .subject {
      margin: 10px 0;
      padding: 7px 9px;
      border: 1px solid #dbe4f0;
      background: #f8fafc;
      font-size: 10.4px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.55px;
      text-align: center;
    }
    p { margin: 0 0 7px; text-align: justify; }
    .section-title {
      margin: 10px 0 5px;
      font-size: 10.5px;
      font-weight: 700;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.45px;
    }
    ul { margin: 0 0 8px; padding-left: 16px; }
    li { margin-bottom: 4px; padding-left: 1px; }
    .signature-wrap {
      margin-top: 12px;
      display: table;
      width: 100%;
    }
    .signature-col {
      display: table-cell;
      width: 50%;
      vertical-align: top;
      padding-right: 16px;
    }
    .signature-col:last-child {
      padding-right: 0;
      padding-left: 12px;
    }
    .signature-label {
      font-weight: 700;
      margin-bottom: 22px;
    }
    .signature-line {
      margin-top: 16px;
      border-top: 1px solid #94a3b8;
      width: 88%;
    }
    .muted { color: #475569; }
  </style>
</head>
<body>
  <div class="page">
    <div class="letterhead">
      <h1>BROTHERS IT SOLUTION</h1>
      <p>Near Main Market, Basti - 272124, Uttar Pradesh, India</p>
      <p>+91 98765 43210 | hr@brothersitsolution.com</p>
    </div>

    <div class="meta">
      <div class="meta-row">
        <div class="meta-cell"><strong>Ref No:</strong> BITS/OFFER/${new Date().getFullYear()}/${Math.floor(1000 + Math.random() * 9000)}</div>
        <div class="meta-cell meta-right"><strong>Date:</strong> ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
      </div>
    </div>

    <div class="recipient">
      <div><strong>To,</strong></div>
      <div class="recipient-name">${employeeName}</div>
      <div><strong>Department:</strong> ${departmentName}</div>
    </div>

    <div class="subject">Offer of Employment</div>

    <p>Dear <strong>${firstName}</strong>,</p>

    <p>We are pleased to offer you the position of <strong>${employeeRole}</strong> in the <strong>${departmentName}</strong> department at <strong>Brothers IT Solution</strong>. Your date of joining will be <strong>${formattedJoiningDate}</strong>, subject to completion of joining formalities, submission of required documents, and verification as per company policy.</p>

    <p>Your annual gross compensation will be <strong>${formattedSalary}</strong>. The salary structure, statutory components, reimbursements, and other benefits applicable to your role will be administered in accordance with prevailing company policy and applicable law.</p>

    <div class="section-title">Key Terms of Employment</div>
    <ul>
      <li><strong>Working Hours:</strong> Your standard working hours will be <strong>10:00 AM to 5:00 PM</strong>, Monday through Saturday, or as otherwise communicated by management.</li>
      <li><strong>Probation and Confirmation:</strong> Your appointment will remain subject to satisfactory performance, conduct, and successful completion of the probation period, where applicable.</li>
      <li><strong>Notice Period:</strong> Either party may terminate employment by giving <strong>30 days</strong> written notice or salary in lieu thereof, subject to company approval and applicable policy.</li>
      <li><strong>Confidentiality:</strong> You will be required to maintain strict confidentiality of all company, client, employee, and business information during and after your employment.</li>
      <li><strong>Compliance:</strong> You are expected to follow all company rules, policies, reporting requirements, and lawful instructions issued by the organization from time to time.</li>
      <li><strong>Verification Requirement:</strong> This offer is contingent upon satisfactory verification of your academic, professional, identity, and other supporting documents.</li>
    </ul>

    <div class="section-title">General Conditions</div>
    <p>This letter, together with applicable company policies, forms the basis of your employment terms. By accepting this offer, you agree to discharge your duties diligently, uphold professional standards, and act in the best interests of the organization at all times.</p>

    <p>Kindly sign and return a copy of this letter as confirmation of your acceptance of the above terms and conditions.</p>

    <div class="signature-wrap">
      <div class="signature-col">
        <div class="signature-label">For Brothers IT Solution</div>
        <div><strong>${hrName}</strong></div>
        <div class="muted">Human Resources</div>
        <div class="muted">Authorized Signatory</div>
        <div class="signature-line"></div>
      </div>
      <div class="signature-col">
        <div class="signature-label">Employee Acceptance</div>
        <div>Name: <strong>${employeeName}</strong></div>
        <div>Signature: ____________________</div>
        <div>Date: ____________________</div>
        <div class="signature-line"></div>
      </div>
    </div>
  </div>
</body>
</html>
`;

exports.generateOfferLetter = async (req, res) => {
  try {
    const { employeeId, joiningDate, role } = req.body;

    if (!mongoose.Types.ObjectId.isValid(employeeId)) {
      return res.status(400).json({ success: false, message: 'Invalid employee id' });
    }

    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const linkedUser = await User.findOne({ email: employee.email });
    if (!linkedUser) {
      return res.status(404).json({ success: false, message: 'No HRMS user account is linked to this employee email' });
    }

    const hrName = req.user?.name || '[HR Name]';
    const employeeRole = role || employee.role || '[Role]';
    const employeeName = employee.name || '[Employee Name]';
    const firstName = employee.name ? employee.name.split(' ')[0] : '[First Name]';
    const departmentName = employee.department || '[Department Name]';
    const formattedJoiningDate = joiningDate
      ? new Date(joiningDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
      : '[Joining Date]';
    const formattedSalary = employee.salary
      ? `Rs. ${employee.salary.toLocaleString('en-IN')} per annum`
      : '[Salary]';

    const htmlContent = buildOfferLetterHtml({
      employeeName,
      firstName,
      employeeRole,
      departmentName,
      formattedJoiningDate,
      formattedSalary,
      hrName
    });

    const fileName = `offer_${employee._id}_${Date.now()}.pdf`;
    const absolutePath = path.join(uploadsRoot, fileName);

    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setContent(htmlContent);
    await page.pdf({
      path: absolutePath,
      format: 'A4',
      margin: { top: '12mm', bottom: '12mm', left: '12mm', right: '12mm' },
      printBackground: true
    });
    await browser.close();

    const document = await Document.create({
      employeeId: linkedUser._id,
      documentType: 'Offer Letter',
      displayName: 'Offer Letter',
      originalNameEncrypted: encryptText(`${employeeName}-Offer-Letter.pdf`),
      fileUrlEncrypted: encryptText(`/uploads/${fileName}`),
      mimeType: 'application/pdf',
      fileSize: fs.statSync(absolutePath).size,
      uploadedBy: req.user._id,
      uploadedByRole: req.user.role === 'admin' ? 'admin' : 'employee',
      status: 'Verified',
    });

    res.status(200).json({
      success: true,
      data: {
        ...serializeDocument(document, req),
        employeeEmail: linkedUser.email,
        employeeName,
      }
    });
  } catch (error) {
    console.error('generateOfferLetter error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload a valid PDF, JPG, or PNG file' });
    }

    const employeeUser = await resolveEmployeeUserId(req, req.body.employeeId);
    if (employeeUser.role !== 'employee' && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only employee documents can be uploaded here' });
    }

    const documentType = req.body.documentType || req.body.type;
    if (!['Aadhaar', 'Resume', 'Certificate', 'Other', 'Offer Letter'].includes(documentType)) {
      return res.status(400).json({ success: false, message: 'Invalid document type' });
    }

    const displayName = String(req.body.displayName || req.body.name || path.parse(req.file.originalname).name).trim();
    if (!displayName) {
      return res.status(400).json({ success: false, message: 'Document name is required' });
    }

    const relativeFileUrl = `/uploads/documents/${req.file.filename}`;
    const document = await Document.create({
      employeeId: employeeUser._id,
      documentType,
      displayName,
      originalNameEncrypted: encryptText(req.file.originalname),
      fileUrlEncrypted: encryptText(relativeFileUrl),
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      uploadedBy: req.user._id,
      uploadedByRole: req.user.role === 'admin' ? 'admin' : 'employee',
      status: req.user.role === 'admin' ? 'Verified' : 'Pending',
    });

    res.status(201).json({
      success: true,
      data: serializeDocument(document, req)
    });
  } catch (error) {
    console.error('uploadDocument error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.getMyDocuments = async (req, res) => {
  try {
    const documents = await Document.find({ employeeId: req.user._id }).sort('-createdAt');
    res.status(200).json({
      success: true,
      count: documents.length,
      data: documents.map((document) => serializeDocument(document, req))
    });
  } catch (error) {
    console.error('getMyDocuments error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.getEmployeeDocuments = async (req, res) => {
  try {
    const { employeeId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(employeeId)) {
      return res.status(400).json({ success: false, message: 'Invalid employee id' });
    }

    if (!canAccessEmployeeDocuments(req.user, employeeId)) {
      return res.status(403).json({ success: false, message: 'Not authorized to view these documents' });
    }

    const documents = await Document.find({ employeeId }).sort('-createdAt');
    res.status(200).json({
      success: true,
      count: documents.length,
      data: documents.map((document) => serializeDocument(document, req))
    });
  } catch (error) {
    console.error('getEmployeeDocuments error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.deleteDocument = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid document id' });
    }

    const document = await Document.findById(req.params.id);
    if (!document) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    if (req.user.role !== 'admin' && String(req.user._id) !== String(document.employeeId)) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this document' });
    }

    const absolutePath = getSafeRelativeFileUrl(decryptText(document.fileUrlEncrypted));
    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }

    await document.deleteOne();
    res.status(200).json({ success: true, message: 'Document deleted successfully' });
  } catch (error) {
    console.error('deleteDocument error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.previewDocument = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid document id' });
    }

    const document = await Document.findById(req.params.id);
    if (!document) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    if (req.user.role !== 'admin' && String(req.user._id) !== String(document.employeeId)) {
      return res.status(403).json({ success: false, message: 'Not authorized to preview this document' });
    }

    const absolutePath = getSafeRelativeFileUrl(decryptText(document.fileUrlEncrypted));
    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ success: false, message: 'File not found on server' });
    }

    res.setHeader('Content-Type', document.mimeType);
    return res.sendFile(absolutePath);
  } catch (error) {
    console.error('previewDocument error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.downloadDocument = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid document id' });
    }

    const document = await Document.findById(req.params.id);
    if (!document) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    if (req.user.role !== 'admin' && String(req.user._id) !== String(document.employeeId)) {
      return res.status(403).json({ success: false, message: 'Not authorized to download this document' });
    }

    const absolutePath = getSafeRelativeFileUrl(decryptText(document.fileUrlEncrypted));
    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ success: false, message: 'File not found on server' });
    }

    return res.download(absolutePath, decryptText(document.originalNameEncrypted));
  } catch (error) {
    console.error('downloadDocument error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
