import React, { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import api from '../../utils/api';
import './Employee.css';

const MySalary = () => {
  const [history, setHistory] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const fetchSalaryData = async () => {
      try {
        const res = await api.get('/salary/my');
        setHistory(res.data.data.history);
        setSettings(res.data.data.currentSettings);
      } catch (err) {
        console.error('Failed to load salary data', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSalaryData();
  }, []);

  const handleDownload = (record) => {
    setDownloading(record._id);
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFontSize(22);
    doc.setTextColor(79, 70, 229); // var(--primary)
    doc.text("HRMS - PAYSLIP", pageWidth / 2, 20, { align: "center" });

    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(`Period: ${record.month} ${record.year}`, pageWidth / 2, 30, { align: "center" });
    
    doc.setDrawColor(200);
    doc.line(20, 35, pageWidth - 20, 35);

    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text("Payment Summary", 20, 50);
    
    const tableData = [
      ["Description", "Amount"],
      ["Base Salary", `$${record.baseSalary.toLocaleString()}`],
      ["HRA", `$${record.hra.toLocaleString()}`],
      ["Bonus", `$${record.bonus.toLocaleString()}`],
      ["Allowances", `$${record.allowances.toLocaleString()}`],
      ["Deductions", `-$${record.deductions.toLocaleString()}`],
      ["Net Salary", `$${record.netSalary.toLocaleString()}`]
    ];

    autoTable(doc, {
      startY: 60,
      head: [tableData[0]],
      body: tableData.slice(1),
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229], textColor: 255 },
      styles: { fontSize: 11, cellPadding: 6 }
    });

    const finalY = doc.lastAutoTable.finalY + 15;
    doc.setFontSize(16);
    doc.setTextColor(16, 185, 129); // var(--success)
    doc.text(`TOTAL PAID: $${record.netSalary.toLocaleString()}`, pageWidth - 20, finalY, { align: "right" });

    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Paid on: ${new Date(record.paymentDate).toLocaleDateString()}`, 20, finalY + 10);
    doc.text("This is an electronically generated document.", pageWidth / 2, finalY + 30, { align: "center" });

    doc.save(`Payslip_${record.month}_${record.year}.pdf`);
    setDownloading(false);
  };

  if (loading) {
    return <div className="employee-page"><div className="spinner-container"><div className="spinner"></div></div></div>;
  }

  const latest = history[0] || null;

  return (
    <div className="animate-fade-in employee-page">
      <div className="dashboard-header" style={{ marginBottom: '2.5rem' }}>
        <div>
          <h1 className="dashboard-title">Financial Overview</h1>
          <p className="dashboard-subtitle">Track your earnings, deductions, and payment history.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '2rem', marginBottom: '3rem' }}>
        {/* Latest Month Highlight */}
        <div className="glass-panel p-8" style={{ borderTop: '4px solid var(--primary)', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
             <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Latest Payment</h2>
             {latest && <span className="badge badge-success">{latest.month} {latest.year}</span>}
          </div>
          
          {latest ? (
            <div className="salary-snapshot-detailed">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>
                <div className="balance-item">
                  <span className="label">Base Pay</span>
                  <span className="value">${latest.baseSalary.toLocaleString()}</span>
                </div>
                <div className="balance-item">
                  <span className="label">Allowances / HRA</span>
                  <span className="value" style={{color: 'var(--success)'}}>${(latest.hra + latest.allowances).toLocaleString()}</span>
                </div>
                <div className="balance-item">
                  <span className="label">Bonus</span>
                  <span className="label" style={{color: 'var(--primary-light)'}}>${latest.bonus.toLocaleString()}</span>
                </div>
                <div className="balance-item">
                  <span className="label">Deductions</span>
                  <span className="value" style={{color: 'var(--danger)'}}>-${latest.deductions.toLocaleString()}</span>
                </div>
              </div>
              
              <div style={{ 
                background: 'rgba(255,255,255,0.03)', 
                padding: '1.5rem', 
                borderRadius: '12px', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                border: '1px solid var(--border-glass)'
              }}>
                <div>
                  <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Net Amount Credited</span>
                  <span style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--success)' }}>${latest.netSalary.toLocaleString()}</span>
                </div>
                <button 
                  className="btn btn-primary" 
                  onClick={() => handleDownload(latest)}
                  disabled={downloading === latest._id}
                >
                  {downloading === latest._id ? '...' : 'Download PDF'}
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-10 text-muted">No payment records found yet.</div>
          )}
        </div>

        {/* Current Salary Configuration */}
        <div className="glass-panel p-8">
           <h3 style={{ marginBottom: '1.5rem' }}>Active Configuration</h3>
           {settings ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="text-muted">Monthly Base</span>
                  <span className="text-main font-bold">${settings.base.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="text-muted">HRA (House Rent)</span>
                  <span className="text-main">${settings.details?.hra?.toLocaleString() || 0}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="text-muted">Other Allowances</span>
                  <span className="text-main">${settings.details?.allowances?.toLocaleString() || 0}</span>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '1rem', fontStyle: 'italic' }}>
                  * This configuration is used to generate your monthly payouts. Contact HR for any discrepancies.
                </p>
              </div>
           ) : (
             <p className="text-muted">Loading configuration...</p>
           )}
        </div>
      </div>

      {/* History Table */}
      <div className="glass-panel p-8">
        <h3 style={{ marginBottom: '1.5rem' }}>Payment History</h3>
        <div className="table-wrapper">
          <table className="modern-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Period</th>
                <th>Base Salary</th>
                <th>Additions</th>
                <th>Deductions</th>
                <th>Net Paid</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {history.map(record => (
                <tr key={record._id}>
                  <td><strong>{record.month} {record.year}</strong></td>
                  <td>${record.baseSalary.toLocaleString()}</td>
                  <td style={{ color: 'var(--success)' }}>+${(record.hra + record.bonus + record.allowances).toLocaleString()}</td>
                  <td style={{ color: 'var(--danger)' }}>-${record.deductions.toLocaleString()}</td>
                  <td><strong style={{ color: 'var(--success)' }}>${record.netSalary.toLocaleString()}</strong></td>
                  <td><span className="badge badge-success">{record.status}</span></td>
                  <td>
                    <button 
                      className="btn btn-secondary" 
                      style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem' }}
                      onClick={() => handleDownload(record)}
                      disabled={downloading === record._id}
                    >
                      {downloading === record._id ? '...' :'PDF'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default MySalary;
