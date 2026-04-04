import React, { useEffect, useMemo, useRef, useState } from 'react';
import api, { API_BASE_URL, getApiErrorMessage } from '../../utils/api';
import './Employee.css';

const documentTypeOptions = ['Aadhaar', 'Resume', 'Certificate', 'Other'];

const getFileIcon = (mimeType) => {
  if (mimeType?.includes('pdf')) return 'PDF';
  if (mimeType?.includes('image')) return 'IMG';
  return 'DOC';
};

const MyDocuments = () => {
  const fileInputRef = useRef(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [documentType, setDocumentType] = useState('Aadhaar');
  const [displayName, setDisplayName] = useState('');
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });

  const sortedDocuments = useMemo(
    () => [...documents].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [documents]
  );

  const fetchDocuments = async () => {
    try {
      const res = await api.get('/documents/my');
      setDocuments(res.data.data);
    } catch (error) {
      setStatusMsg({ type: 'error', text: getApiErrorMessage(error, 'Failed to load documents') });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const setFileState = (file) => {
    if (!file) return;
    setSelectedFile(file);
    if (!displayName) {
      setDisplayName(file.name.replace(/\.[^/.]+$/, ''));
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragActive(false);
    setFileState(event.dataTransfer.files?.[0]);
  };

  const handleUpload = async (event) => {
    event.preventDefault();
    if (!selectedFile) {
      setStatusMsg({ type: 'error', text: 'Please choose a file to upload.' });
      return;
    }

    const formData = new FormData();
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

      if (!response.ok) {
        throw new Error('Unable to open document');
      }

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

  return (
    <div className="animate-fade-in employee-page">
      <div className="dashboard-header" style={{ marginBottom: '2rem' }}>
        <div>
          <h1 className="dashboard-title">Document Vault</h1>
          <p className="dashboard-subtitle">Upload and manage your important documents securely.</p>
        </div>
      </div>

      <div className="document-vault-layout">
        <div className="glass-panel p-6 document-upload-panel">
          <h3 style={{ marginBottom: '1.25rem' }}>Upload Document</h3>
          <form onSubmit={handleUpload}>
            <div className="leave-form-group">
              <label>Document Type</label>
              <select className="leave-input" value={documentType} onChange={(e) => setDocumentType(e.target.value)}>
                {documentTypeOptions.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>

            <div className="leave-form-group">
              <label>Rename File</label>
              <input
                type="text"
                className="leave-input"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter a clean document name"
              />
            </div>

            <div
              className={`document-drop-zone ${dragActive ? 'active' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
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

            <button type="submit" className="btn btn-primary mt-4" style={{ width: '100%' }} disabled={uploading}>
              {uploading ? 'Uploading...' : 'Upload Document'}
            </button>
          </form>
        </div>

        <div className="glass-panel p-6">
          <h3 style={{ marginBottom: '1.25rem' }}>My Documents</h3>
          {loading ? (
            <div className="text-center py-10"><div className="spinner"></div></div>
          ) : sortedDocuments.length === 0 ? (
            <div className="text-center py-10 text-muted">No documents uploaded yet.</div>
          ) : (
            <div className="document-grid">
              {sortedDocuments.map((document) => (
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

export default MyDocuments;
