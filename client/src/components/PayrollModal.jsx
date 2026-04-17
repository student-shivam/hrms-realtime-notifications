import React from 'react';

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(value);

const PayrollModal = ({ employee, isOpen, onClose }) => {
  if (!employee) {
    return null;
  }

  const netSalary = employee.basicSalary + employee.hra + employee.allowances + employee.bonus - employee.deductions;

  return (
    <div
      className={`payroll-modal ${isOpen ? 'payroll-modal--open' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="payroll-modal-title"
      onClick={onClose}
    >
      <div className="payroll-modal__dialog" onClick={(event) => event.stopPropagation()}>
        <div className="payroll-modal__header">
          <div>
            <p className="payroll-modal__eyebrow">Salary breakdown</p>
            <h3 id="payroll-modal-title">{employee.name}</h3>
            <span>{employee.department} • {employee.employeeId}</span>
          </div>
          <button type="button" className="payroll-modal__close" onClick={onClose} aria-label="Close salary breakdown">
            ×
          </button>
        </div>

        <div className="payroll-modal__body">
          <div className="payroll-modal__grid">
            <div className="payroll-modal__metric">
              <span>Basic Salary</span>
              <strong>{formatCurrency(employee.basicSalary)}</strong>
            </div>
            <div className="payroll-modal__metric">
              <span>HRA</span>
              <strong>{formatCurrency(employee.hra)}</strong>
            </div>
            <div className="payroll-modal__metric">
              <span>Allowances</span>
              <strong>{formatCurrency(employee.allowances)}</strong>
            </div>
            <div className="payroll-modal__metric">
              <span>Bonus</span>
              <strong>{formatCurrency(employee.bonus)}</strong>
            </div>
            <div className="payroll-modal__metric payroll-modal__metric--deduction">
              <span>Deductions</span>
              <strong>-{formatCurrency(employee.deductions)}</strong>
            </div>
            <div className="payroll-modal__metric payroll-modal__metric--net">
              <span>Net Salary</span>
              <strong>{formatCurrency(netSalary)}</strong>
            </div>
          </div>

          <div className="payroll-modal__note">
            Includes fixed compensation, housing allowance, monthly allowances, applied bonus, and payroll deductions for the selected cycle.
          </div>
        </div>
      </div>
    </div>
  );
};

export default PayrollModal;
