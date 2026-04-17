import React from 'react';
import '../styles/payroll.css';

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(value || 0);

const EmployeePayrollPage = ({ latest, settings, history, downloading, onDownload }) => {
  const additions = latest ? (latest.hra || 0) + (latest.allowances || 0) + (latest.bonus || 0) : 0;

  return (
    <section className="payroll-dashboard payroll-dashboard--employee animate-fade-in">
      <header className="payroll-hero payroll-hero--employee">
        <div>
          <span className="payroll-hero__eyebrow">Personal Salary Desk</span>
          <h1>My Salary</h1>
          <p>Track your latest payout, salary structure, and payslip history in one place.</p>
        </div>
        <div className="payroll-hero__pill">
          <span>Latest salary period</span>
          <strong>{latest ? `${latest.month} ${latest.year}` : 'No record yet'}</strong>
        </div>
      </header>

      <section className="payroll-chart-grid payroll-chart-grid--employee">
        <article className="payroll-panel payroll-panel--feature">
          <div className="payroll-panel__header">
            <div>
              <span>Latest payout</span>
              <h2>Salary breakdown</h2>
            </div>
            {latest ? <span className="payroll-status payroll-status--paid">{latest.status || 'Paid'}</span> : null}
          </div>

          {latest ? (
            <div className="employee-payroll-feature">
              <div className="employee-payroll-grid">
                <div className="employee-payroll-metric">
                  <span>Base salary</span>
                  <strong>{formatCurrency(latest.baseSalary)}</strong>
                </div>
                <div className="employee-payroll-metric">
                  <span>Allowances + HRA</span>
                  <strong className="employee-payroll-positive">{formatCurrency((latest.hra || 0) + (latest.allowances || 0))}</strong>
                </div>
                <div className="employee-payroll-metric">
                  <span>Bonus</span>
                  <strong>{formatCurrency(latest.bonus)}</strong>
                </div>
                <div className="employee-payroll-metric">
                  <span>Deductions</span>
                  <strong className="employee-payroll-negative">-{formatCurrency(latest.deductions)}</strong>
                </div>
              </div>

              <div className="employee-payroll-total">
                <div>
                  <span>Net salary credited</span>
                  <strong>{formatCurrency(latest.netSalary)}</strong>
                  <p>Paid on {new Date(latest.paymentDate).toLocaleDateString()}</p>
                </div>
                <button
                  type="button"
                  className="payroll-button payroll-button--primary"
                  onClick={() => onDownload(latest)}
                  disabled={downloading === latest._id}
                >
                  {downloading === latest._id ? 'Preparing...' : 'Download Payslip'}
                </button>
              </div>
            </div>
          ) : (
            <div className="payroll-empty-state">
              <div className="payroll-empty-state__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M5 7.5A2.5 2.5 0 0 1 7.5 5h9A2.5 2.5 0 0 1 19 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 5 16.5v-9Z" />
                  <path d="M8.5 10.5h7M8.5 13.5h5" />
                </svg>
              </div>
              <h3>No salary records found</h3>
              <p>Your salary history will appear here once payroll is processed.</p>
            </div>
          )}
        </article>

        <article className="payroll-panel payroll-panel--insight">
          <div className="payroll-panel__header">
            <div>
              <span>Current setup</span>
              <h2>Salary structure</h2>
            </div>
          </div>

          <div className="payroll-insights employee-payroll-structure">
            <div>
              <span>Monthly base</span>
              <strong>{formatCurrency(settings?.base)}</strong>
            </div>
            <div>
              <span>HRA</span>
              <strong>{formatCurrency(settings?.details?.hra)}</strong>
            </div>
            <div>
              <span>Other allowances</span>
              <strong>{formatCurrency(settings?.details?.allowances)}</strong>
            </div>
            <div>
              <span>Latest additions</span>
              <strong>{formatCurrency(additions)}</strong>
            </div>
          </div>
        </article>
      </section>

      <section className="payroll-panel payroll-panel--table">
        <div className="payroll-panel__header">
          <div>
            <span>Payment history</span>
            <h2>Previous salary statements</h2>
          </div>
        </div>

        <div className="payroll-table-wrap">
          <table className="payroll-table payroll-table--employee">
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
              {history.length ? (
                history.map((record) => (
                  <tr key={record._id}>
                    <td>
                      <div className="payroll-table__employee">
                        <div className="payroll-table__avatar">{record.month?.charAt(0)}</div>
                        <div>
                          <strong>{record.month} {record.year}</strong>
                          <span>Payroll cycle</span>
                        </div>
                      </div>
                    </td>
                    <td>{formatCurrency(record.baseSalary)}</td>
                    <td className="payroll-table__amount payroll-table__amount--positive">
                      +{formatCurrency((record.hra || 0) + (record.allowances || 0) + (record.bonus || 0))}
                    </td>
                    <td className="payroll-table__amount payroll-table__amount--negative">
                      -{formatCurrency(record.deductions)}
                    </td>
                    <td>{formatCurrency(record.netSalary)}</td>
                    <td><span className="payroll-status payroll-status--paid">{record.status || 'Paid'}</span></td>
                    <td>
                      <button
                        type="button"
                        className="payroll-action payroll-action--secondary"
                        onClick={() => onDownload(record)}
                        disabled={downloading === record._id}
                      >
                        {downloading === record._id ? 'Preparing...' : 'Download'}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7">
                    <div className="payroll-empty-state">
                      <h3>No payment history yet</h3>
                      <p>Your processed payslips will appear here.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
};

export default EmployeePayrollPage;
