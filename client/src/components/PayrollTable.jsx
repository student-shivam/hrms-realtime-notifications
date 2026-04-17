import React from 'react';

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(value);

const PayrollTable = ({ employees, onView, onEdit, onPay }) => {
  if (!employees.length) {
    return (
      <div className="payroll-empty-state">
        <div className="payroll-empty-state__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M5 7.5A2.5 2.5 0 0 1 7.5 5h9A2.5 2.5 0 0 1 19 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 5 16.5v-9Z" />
            <path d="M8.5 10.5h7M8.5 13.5h5" />
          </svg>
        </div>
        <h3>No payroll records found</h3>
        <p>Adjust your search or filters to view employees for this payroll cycle.</p>
      </div>
    );
  }

  return (
    <div className="payroll-table-wrap">
      <table className="payroll-table">
        <thead>
          <tr>
            <th>Employee Name</th>
            <th>Employee ID</th>
            <th>Department</th>
            <th>Basic Salary</th>
            <th>Deductions</th>
            <th>Bonus</th>
            <th>Net Salary</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {employees.map((employee) => (
            <tr key={employee.id}>
              <td>
                <div className="payroll-table__employee">
                  <div className="payroll-table__avatar" aria-hidden="true">
                    {employee.name.charAt(0)}
                  </div>
                  <div>
                    <strong>{employee.name}</strong>
                    <span>{employee.role}</span>
                  </div>
                </div>
              </td>
              <td>{employee.employeeId}</td>
              <td>{employee.department}</td>
              <td>{formatCurrency(employee.basicSalary)}</td>
              <td className="payroll-table__amount payroll-table__amount--negative">
                -{formatCurrency(employee.deductions)}
              </td>
              <td className="payroll-table__amount payroll-table__amount--positive">
                +{formatCurrency(employee.bonus)}
              </td>
              <td>{formatCurrency(employee.netSalary)}</td>
              <td>
                <span className={`payroll-status payroll-status--${employee.status.toLowerCase()}`}>
                  {employee.status}
                </span>
              </td>
              <td>
                <div className="payroll-table__actions">
                  <button type="button" className="payroll-action payroll-action--ghost" onClick={() => onView(employee)}>
                    View
                  </button>
                  <button type="button" className="payroll-action payroll-action--secondary" onClick={() => onEdit(employee)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="payroll-action payroll-action--primary"
                    onClick={() => onPay(employee)}
                    disabled={employee.status === 'Paid'}
                  >
                    {employee.status === 'Paid' ? 'Paid' : 'Pay'}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default PayrollTable;
