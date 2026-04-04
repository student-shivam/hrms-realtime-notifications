import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import api, { API_BASE_URL, getApiErrorMessage } from '../../utils/api';

const GenerateDocument = () => {
  const { user } = useSelector((state) => state.auth);
  const [employees, setEmployees] = useState([]);
  const [selectedEmp, setSelectedEmp] = useState('');
  const [role, setRole] = useState('');
  const [joiningDate, setJoiningDate] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatedDoc, setGeneratedDoc] = useState(null);

  useEffect(() => {
    api.get('/employees').then((res) => setEmployees(res.data.data)).catch((err) => console.error(err));
  }, []);

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!selectedEmp) return setStatus('Please select an employee.');

    setLoading(true);
    setStatus('Generating Offer Letter...');
    setGeneratedDoc(null);

    try {
      const res = await api.post('/documents/generate-offer', {
        employeeId: selectedEmp,
        role,
        joiningDate
      });
      setStatus('Success! Offer Letter generated.');
      setGeneratedDoc(res.data.data);
      setRole('');
      setJoiningDate('');
    } catch (err) {
      console.error(err);
      setStatus(getApiErrorMessage(err, 'Failed to generate document'));
    } finally {
      setLoading(false);
    }
  };

  const selectedEmpObj = employees.find((e) => e._id === selectedEmp) || {};
  const employeeName = selectedEmpObj.name || '[Employee Name]';
  const firstName = selectedEmpObj.name ? selectedEmpObj.name.split(' ')[0] : '[First Name]';
  const employeeRole = role || selectedEmpObj.role || '[Role]';
  const departmentName = selectedEmpObj.department || '[Department Name]';
  const formattedJoiningDate = joiningDate
    ? new Date(joiningDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : '[Joining Date]';
  const formattedSalary = selectedEmpObj.salary
    ? `Rs. ${selectedEmpObj.salary.toLocaleString('en-IN')} per annum`
    : '[Salary]';
  const hrName = user?.name || '[HR Name]';
  const emailSubject = generatedDoc ? encodeURIComponent(`Offer Letter - ${generatedDoc.employeeName || employeeName}`) : '';
  const emailBody = generatedDoc ? encodeURIComponent(
    `Dear ${firstName},\n\nPlease find your offer letter here:\n${API_BASE_URL.replace(/\/api$/, '')}${generatedDoc.downloadUrl}\n\nRegards,\n${hrName}`
  ) : '';

  const handleSecureOpen = async (endpoint, downloadName) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL.replace(/\/api$/, '')}${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Unable to access file');

      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      if (downloadName) {
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = downloadName;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      } else {
        window.open(objectUrl, '_blank', 'noopener,noreferrer');
      }
      setTimeout(() => window.URL.revokeObjectURL(objectUrl), 4000);
    } catch (error) {
      setStatus(getApiErrorMessage(error, 'Unable to access generated document'));
    }
  };

  return (
    <div className="admin-page animate-fade-in">
      <div className="dashboard-header" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h1 className="dashboard-title">Offer Letter Generator</h1>
          <p className="dashboard-subtitle">Generate a clean, print-ready employment offer letter for selected employees.</p>
        </div>
      </div>

      <div className="dashboard-bottom-grid">
        <div className="glass-panel p-6 animate-fade-in">
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', fontFamily: 'var(--font-heading)' }}>Contract Configuration</h2>
          <form onSubmit={handleGenerate} className="flex flex-col gap-4">
            <div className="form-group">
              <label>Select Employee</label>
              <select required value={selectedEmp} onChange={(e) => setSelectedEmp(e.target.value)}>
                <option value="">-- Choose Employee --</option>
                {employees.map((emp) => (
                  <option key={emp._id} value={emp._id}>{emp.name} ({emp.department}) - ${emp.salary}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Role / Designation Override (Optional)</label>
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. Senior Software Engineer"
              />
            </div>

            <div className="form-group">
              <label>Joining Date</label>
              <input
                type="date"
                required
                value={joiningDate}
                onChange={(e) => setJoiningDate(e.target.value)}
              />
            </div>

            <button type="submit" disabled={loading} className="btn btn-primary mt-4 w-full">
              {loading ? 'Generating...' : 'Generate PDF'}
            </button>

            {status && (
              <div style={{ padding: '1rem', marginTop: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', textAlign: 'center', color: 'var(--primary)' }}>
                {status}
              </div>
            )}

            {generatedDoc && (
              <div style={{ padding: '1.5rem', marginTop: '1rem', border: '1px solid var(--success)', borderRadius: '8px', textAlign: 'center' }}>
                <h3 style={{ color: 'var(--success)', marginBottom: '0.5rem' }}>Document Ready</h3>
                <p style={{ marginBottom: '1rem' }}>The offer letter has been generated and saved to the employee&apos;s profile.</p>
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => handleSecureOpen(generatedDoc.previewUrl)}>
                    View PDF
                  </button>
                  <button type="button" className="btn btn-primary" onClick={() => handleSecureOpen(generatedDoc.downloadUrl, `${generatedDoc.employeeName || employeeName}-Offer-Letter.pdf`)}>
                    Download PDF
                  </button>
                  <a
                    href={`mailto:${generatedDoc.employeeEmail || ''}?subject=${emailSubject}&body=${emailBody}`}
                    className="btn btn-secondary"
                  >
                    Send via Email
                  </a>
                </div>
              </div>
            )}
          </form>
        </div>

        <div className="glass-panel p-6 animate-fade-in" style={{ display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', fontFamily: 'var(--font-heading)' }}>Live Preview</h2>
          <div
            style={{
              background: 'white',
              color: '#1f2937',
              padding: '26px 30px',
              borderRadius: '4px',
              flexGrow: 1,
              overflowY: 'auto',
              maxHeight: '800px',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
              fontFamily: 'Arial, Helvetica, sans-serif',
              lineHeight: '1.38',
              fontSize: '13px'
            }}
          >
            <div style={{ textAlign: 'center', borderBottom: '1.5px solid #1f2937', paddingBottom: '12px', marginBottom: '18px' }}>
              <h1 style={{ color: '#111827', fontSize: '22px', fontWeight: '700', margin: 0, letterSpacing: '0.8px' }}>BROTHERS IT SOLUTION</h1>
              <p style={{ margin: '4px 0 2px', fontSize: '12px', color: '#4b5563' }}>Near Main Market, Basti - 272124, Uttar Pradesh, India</p>
              <p style={{ margin: 0, fontSize: '12px', color: '#4b5563' }}>+91 98765 43210 | hr@brothersitsolution.com</p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px', fontSize: '12px' }}>
              <p style={{ margin: 0 }}><strong>Ref No:</strong> BITS/OFFER/{new Date().getFullYear()}/{Math.floor(1000 + Math.random() * 9000)}</p>
              <p style={{ margin: 0 }}><strong>Date:</strong> {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <p style={{ margin: '0 0 2px' }}><strong>To,</strong></p>
              <p style={{ margin: '0 0 2px', fontSize: '14px', fontWeight: '700' }}>{employeeName}</p>
              <p style={{ margin: 0 }}><strong>Department:</strong> {departmentName}</p>
            </div>

            <div style={{ margin: '0 0 12px', padding: '7px 9px', border: '1px solid #dbe4f0', background: '#f8fafc', fontSize: '12px', fontWeight: '700', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Offer of Employment
            </div>

            <p style={{ margin: '0 0 10px' }}>Dear <strong>{firstName}</strong>,</p>

            <p style={{ margin: '0 0 10px', textAlign: 'justify' }}>
              We are pleased to offer you the position of <strong>{employeeRole}</strong> in the <strong>{departmentName}</strong> department at <strong>Brothers IT Solution</strong>. Your date of joining will be <strong>{formattedJoiningDate}</strong>, subject to completion of joining formalities, submission of required documents, and verification as per company policy.
            </p>

            <p style={{ margin: '0 0 10px', textAlign: 'justify' }}>
              Your annual gross compensation will be <strong>{formattedSalary}</strong>. The salary structure, statutory components, reimbursements, and other benefits applicable to your role will be administered in accordance with prevailing company policy and applicable law.
            </p>

            <div style={{ marginTop: '12px' }}>
              <h4 style={{ fontSize: '12px', fontWeight: '700', margin: '0 0 6px', color: '#111827', textTransform: 'uppercase', letterSpacing: '0.45px' }}>Key Terms of Employment</h4>
              <ul style={{ margin: 0, paddingLeft: '18px' }}>
                <li style={{ marginBottom: '4px' }}><strong>Working Hours:</strong> Your standard working hours will be <strong>10:00 AM to 5:00 PM</strong>, Monday through Saturday, or as otherwise notified by management.</li>
                <li style={{ marginBottom: '4px' }}><strong>Probation and Confirmation:</strong> Your appointment will remain subject to satisfactory performance, conduct, and successful completion of the probation period, where applicable.</li>
                <li style={{ marginBottom: '4px' }}><strong>Notice Period:</strong> Either party may terminate employment by giving <strong>30 days</strong> written notice or salary in lieu thereof, subject to company approval and applicable policy.</li>
                <li style={{ marginBottom: '4px' }}><strong>Confidentiality:</strong> You will be required to maintain strict confidentiality of all company, client, employee, and business information during and after your employment.</li>
                <li style={{ marginBottom: '4px' }}><strong>Compliance:</strong> You are expected to follow all company rules, policies, reporting requirements, and lawful instructions issued by the organization from time to time.</li>
                <li><strong>Verification Requirement:</strong> This offer is contingent upon satisfactory verification of your academic, professional, identity, and other supporting documents.</li>
              </ul>
            </div>

            <div style={{ marginTop: '12px' }}>
              <h4 style={{ fontSize: '12px', fontWeight: '700', margin: '0 0 6px', color: '#111827', textTransform: 'uppercase', letterSpacing: '0.45px' }}>General Conditions</h4>
              <p style={{ margin: 0, textAlign: 'justify' }}>
                This letter, together with applicable company policies, forms the basis of your employment terms. By accepting this offer, you agree to discharge your duties diligently, uphold professional standards, and act in the best interests of the organization at all times.
              </p>
            </div>

            <p style={{ margin: '12px 0 0', textAlign: 'justify' }}>
              Kindly sign and return a copy of this letter as confirmation of your acceptance of the above terms and conditions.
            </p>

            <div style={{ marginTop: '18px', display: 'flex', justifyContent: 'space-between', gap: '20px' }}>
              <div style={{ width: '48%' }}>
                <p style={{ margin: '0 0 24px' }}><strong>For Brothers IT Solution</strong></p>
                <p style={{ margin: '0 0 2px', fontWeight: '700' }}>{hrName}</p>
                <p style={{ margin: '0 0 2px' }}>Human Resources</p>
                <p style={{ margin: 0 }}>Authorized Signatory</p>
                <div style={{ marginTop: '16px', borderTop: '1px solid #94a3b8', width: '88%' }}></div>
              </div>
              <div style={{ width: '48%' }}>
                <p style={{ margin: '0 0 24px' }}><strong>Employee Acceptance</strong></p>
                <p style={{ margin: '0 0 2px' }}>Name: <strong>{employeeName}</strong></p>
                <p style={{ margin: '0 0 2px' }}>Signature: ____________________</p>
                <p style={{ margin: 0 }}>Date: ____________________</p>
                <div style={{ marginTop: '16px', borderTop: '1px solid #94a3b8', width: '88%' }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GenerateDocument;
