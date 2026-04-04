import React, { useEffect, useMemo, useRef, useState } from 'react';
import api, { API_BASE_URL, getApiErrorMessage } from '../../utils/api';
import '../employee/Employee.css';

const documentTypeOptions = ['Aadhaar', 'Resume', 'Certificate', 'Other'];

const getFileIcon = (mimeType) => {
  if (mimeType?.includes('pdf')) return 'PDF';
  if (mimeType?.includes('image')) return 'IMG';
  return 'DOC';
};

const UploadDocument = () => {
  const fileInputRef = useRef(null);
  const [employees, setEmployees] = useState([]);
  const [selectedEmp, setSelectedEmp] = useState('');
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [documentType, setDocumentType] = useState('Aadhaar');
  const [displayName, setDisplayName] = useState('');
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });

  const selectedEmployee = useMemo(
    () => employees.find((employee) => employee._id === selectedEmp) || null,
    [employees, selectedEmp]
  );

  useEffect(() => {
    api.get('/employees')
      .then((res) => setEmployees(res.data.data))
      .catch((error) => setStatusMsg({ type: 'error', text: getApiErrorMessage(error, 'Failed to load employees') }));
  }, []);

  useEffect(() => {
    if (!selectedEmp) {
      setDocuments([]);
      return;
    }

    setLoading(true);
    api.get(`/documents/${selectedEmp}`)
      .then((res) => setDocuments(res.data.data))
      .catch((error) => setStatusMsg({ type: 'error', text: getApiErrorMessage(error, 'Failed to load employee documents') }))
      .finally(() => setLoading(false));
  }, [selectedEmp]);

  const setFileState = (file) => {
    if (!file) return;
    setSelectedFile(file);
    if (!displayName) {
      setDisplayName(file.name.replace(/\.[^/.]+$/, ''));
    }
  };

  const handleUpload = async (event) => {
    event.preventDefault();
    if (!selectedEmp || !selectedFile) {
      setStatusMsg({ type: 'error', text: 'Select an employee and a file first.' });
      return;
    }

    const formData = new FormData();
    formData.append('employeeId', selectedEmp);
    formData.append('file', selectedFile);
    formData.append('documentType', documentType);
    formData.append('displayName', displayName || selectedFile.name.replace(/\.[^/.]+$/, ''));

    setUploading(true);
    setUploadProgress(0);
    setStatusMsg({ type: '', text: '' });

    try {
      const res = await api.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (!progressEvent.total) return;
          setUploadProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
        }
      });

      setDocuments((prev) => [res.data.data, ...prev]);
      setSelectedFile(null);
      setDisplayName('');
      setDocumentType('Aadhaar');
      if (fileInputRef.current) fileInputRef.current.value = '';
      setStatusMsg({ type: 'success', text: 'Document uploaded successfully.' });
    } catch (error) {
      setStatusMsg({ type: 'error', text: getApiErrorMessage(error, 'Upload failed') });
    } finally {
      setUploading(false);
    }
  };

  const handleProtectedOpen = async (endpoint, downloadName) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL.replace(/\/api$/, '')}${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Unable to open document');

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
      setStatusMsg({ type: 'error', text: getApiErrorMessage(error, 'Unable to access document') });
    }
  };

  const handleDelete = async (documentId) => {
    try {
      await api.delete(`/documents/${documentId}`);
      setDocuments((prev) => prev.filter((item) => item._id !== documentId));
      setStatusMsg({ type: 'success', text: 'Document deleted successfully.' });
    } catch (error) {
      setStatusMsg({ type: 'error', text: getApiErrorMessage(error, 'Failed to delete document') });
    }
  };

  return (
    <div className="admin-page animate-fade-in">
      <div className="dashboard-header" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h1 className="dashboard-title">Document Management</h1>
          <p className="dashboard-subtitle">Manage employee documents securely with controlled access and protected downloads.</p>
        </div>
      </div>

      <div className="document-vault-layout">
        <div className="glass-panel p-6 document-upload-panel">
          <h3 style={{ marginBottom: '1.25rem' }}>Upload for Employee</h3>
          <form onSubmit={handleUpload}>
            <div className="form-group">
              <label>Select Employee</label>
              <select required value={selectedEmp} onChange={(e) => setSelectedEmp(e.target.value)}>
                <option value="">-- Choose Employee --</option>
                {employees.map((employee) => (
                  <option key={employee._id} value={employee._id}>{employee.name} ({employee.email})</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Document Type</label>
              <select value={documentType} onChange={(e) => setDocumentType(e.target.value)}>
                {documentTypeOptions.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Rename File</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter document display name"
              />
            </div>

            <div
              className={`document-drop-zone ${dragActive ? 'active' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                setFileState(e.dataTransfer.files?.[0]);
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="document-drop-icon">{selectedFile ? getFileIcon(selectedFile.type) : 'UP'}</div>
              <strong>{selectedFile ? selectedFile.name : 'Drag & drop a file here'}</strong>
              <span>PDF, JPG, PNG only • max 5MB</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                style={{ display: 'none' }}
                onChange={(e) => setFileState(e.target.files?.[0])}
              />
            </div>

            {uploading && (
              <div className="document-progress-wrap">
                <div className="document-progress-bar" style={{ width: `${uploadProgress}%` }} />
                <span>{uploadProgress}% uploaded</span>
              </div>
            )}

            {statusMsg.text && (
              <div className={`status-msg ${statusMsg.type}`} style={{ marginTop: '1rem' }}>
                {statusMsg.text}
              </div>
            )}

            <button type="submit" className="btn btn-primary mt-4 w-full shadow-hover" disabled={uploading}>
              {uploading ? 'Uploading...' : 'Upload Document'}
            </button>
          </form>
        </div>

        <div className="glass-panel p-6">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', gap: '1rem', flexWrap: 'wrap' }}>
            <div>
              <h3 style={{ margin: 0 }}>Employee Documents</h3>
              <p className="text-muted" style={{ margin: '0.35rem 0 0' }}>
                {selectedEmployee ? `${selectedEmployee.name} • ${documents.length} file(s)` : 'Select an employee to view their vault'}
              </p>
            </div>
          </div>

          {!selectedEmp ? (
            <div className="text-center py-10 text-muted">Choose an employee to view and manage their secure documents.</div>
          ) : loading ? (
            <div className="text-center py-10"><div className="spinner"></div></div>
          ) : documents.length === 0 ? (
            <div className="text-center py-10 text-muted">No documents found for this employee.</div>
          ) : (
            <div className="document-grid">
              {documents.map((document) => (
                <div key={document._id} className="document-card">
                  <div className="document-card-top">
                    <div className="document-icon">{getFileIcon(document.mimeType)}</div>
                    <span className={`badge ${document.status === 'Verified' ? 'badge-success' : document.status === 'Rejected' ? 'badge-danger' : 'badge-warning'}`}>
                      {document.status}
                    </span>
                  </div>
                  <h4>{document.displayName}</h4>
                  <p>{document.documentType}</p>
                  <div className="document-meta">
                    <span>{document.originalName}</span>
                    <span>{new Date(document.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="document-actions">
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleProtectedOpen(document.previewUrl)}>
                      Preview
                    </button>
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => handleProtectedOpen(document.downloadUrl, document.originalName)}>
                      Download
                    </button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleDelete(document._id)}>
                      Delete
                    </button>
                  </div>
                  <div className="document-meta" style={{ marginTop: '0.8rem' }}>
                    <span>Uploaded by {document.uploadedByRole}</span>
                    <span>{(document.fileSize / 1024 / 1024).toFixed(2)} MB</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UploadDocument;
