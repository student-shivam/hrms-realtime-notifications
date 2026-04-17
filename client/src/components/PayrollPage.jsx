import React, { useEffect, useMemo, useState } from 'react';
import PayrollCard from './PayrollCard';
import PayrollModal from './PayrollModal';
import PayrollTable from './PayrollTable';
import '../styles/payroll.css';

const payrollSeed = [
  { id: 1, name: 'Sophia Carter', employeeId: 'HRM-1001', department: 'Human Resources', role: 'People Operations Lead', basicSalary: 5200, hra: 900, allowances: 350, deductions: 280, bonus: 450, status: 'Paid', month: 'April 2026' },
  { id: 2, name: 'Liam Bennett', employeeId: 'HRM-1002', department: 'Engineering', role: 'Senior Frontend Engineer', basicSalary: 6800, hra: 1200, allowances: 500, deductions: 440, bonus: 600, status: 'Pending', month: 'April 2026' },
  { id: 3, name: 'Ava Mitchell', employeeId: 'HRM-1003', department: 'Finance', role: 'Payroll Specialist', basicSalary: 4900, hra: 850, allowances: 310, deductions: 210, bonus: 320, status: 'Paid', month: 'April 2026' },
  { id: 4, name: 'Noah Rivera', employeeId: 'HRM-1004', department: 'Marketing', role: 'Growth Strategist', basicSalary: 4300, hra: 760, allowances: 280, deductions: 195, bonus: 250, status: 'Pending', month: 'April 2026' },
  { id: 5, name: 'Emma Thompson', employeeId: 'HRM-1005', department: 'Sales', role: 'Account Executive', basicSalary: 4700, hra: 780, allowances: 260, deductions: 220, bonus: 520, status: 'Paid', month: 'April 2026' },
  { id: 6, name: 'James Walker', employeeId: 'HRM-1006', department: 'Operations', role: 'Operations Manager', basicSalary: 5400, hra: 940, allowances: 390, deductions: 330, bonus: 410, status: 'Pending', month: 'April 2026' }
];

const departmentOptions = ['All Departments', 'Engineering', 'Finance', 'Human Resources', 'Marketing', 'Operations', 'Sales'];
const statusOptions = ['All Statuses', 'Paid', 'Pending'];
const monthOptions = ['April 2026', 'March 2026', 'February 2026'];

const summaryIcons = {
  employees: (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M16 21v-1.4a4.6 4.6 0 0 0-4.6-4.6H7.6A4.6 4.6 0 0 0 3 19.6V21" />
      <path d="M9.5 11A3.5 3.5 0 1 0 9.5 4a3.5 3.5 0 0 0 0 7Z" />
      <path d="M20.5 21v-1.4a4.6 4.6 0 0 0-3.1-4.36" />
      <path d="M15.5 4.23a3.5 3.5 0 0 1 0 6.54" />
    </svg>
  ),
  salary: (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M12 3v18" />
      <path d="M16.5 7.5c0-1.93-2.01-3.5-4.5-3.5s-4.5 1.57-4.5 3.5S9.51 11 12 11s4.5 1.57 4.5 3.5S14.49 18 12 18s-4.5-1.57-4.5-3.5" />
    </svg>
  ),
  pending: (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M12 7v5l3 3" />
      <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  ),
  bonus: (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M12 3l2.82 5.72 6.31.92-4.56 4.44 1.08 6.29L12 17.77l-5.65 2.6 1.08-6.29L2.87 9.64l6.31-.92L12 3Z" />
    </svg>
  )
};

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(value);

const PayrollPage = () => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [department, setDepartment] = useState('All Departments');
  const [status, setStatus] = useState('All Statuses');
  const [month, setMonth] = useState('April 2026');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setEmployees(
        payrollSeed.map((employee) => ({
          ...employee,
          netSalary: employee.basicSalary + employee.hra + employee.allowances + employee.bonus - employee.deductions
        }))
      );
      setLoading(false);
    }, 850);

    return () => window.clearTimeout(timer);
  }, []);

  const filteredEmployees = useMemo(
    () =>
      employees.filter((employee) => {
        const matchesSearch =
          employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          employee.employeeId.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesDepartment = department === 'All Departments' || employee.department === department;
        const matchesStatus = status === 'All Statuses' || employee.status === status;
        const matchesMonth = employee.month === month;

        return matchesSearch && matchesDepartment && matchesStatus && matchesMonth;
      }),
    [department, employees, month, searchTerm, status]
  );

  const summary = useMemo(() => {
    const totalEmployees = filteredEmployees.length;
    const totalSalaryPaid = filteredEmployees
      .filter((employee) => employee.status === 'Paid')
      .reduce((sum, employee) => sum + employee.netSalary, 0);
    const pendingPayments = filteredEmployees
      .filter((employee) => employee.status === 'Pending')
      .reduce((sum, employee) => sum + employee.netSalary, 0);
    const bonusesDistributed = filteredEmployees.reduce((sum, employee) => sum + employee.bonus, 0);

    return { totalEmployees, totalSalaryPaid, pendingPayments, bonusesDistributed };
  }, [filteredEmployees]);

  const handleRunPayroll = () => {
    setEmployees((current) =>
      current.map((employee) => (employee.month === month ? { ...employee, status: 'Paid' } : employee))
    );
  };

  const handleExportCsv = () => {
    const rows = [
      ['Employee Name', 'Employee ID', 'Department', 'Basic Salary', 'Deductions', 'Bonus', 'Net Salary', 'Status'],
      ...filteredEmployees.map((employee) => [
        employee.name,
        employee.employeeId,
        employee.department,
        employee.basicSalary,
        employee.deductions,
        employee.bonus,
        employee.netSalary,
        employee.status
      ])
    ];

    const csv = rows.map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const href = URL.createObjectURL(blob);
    link.href = href;
    link.setAttribute('download', `payroll-${month.toLowerCase().replace(/\s+/g, '-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(href);
  };

  const handlePayEmployee = (employee) => {
    setEmployees((current) => current.map((item) => (item.id === employee.id ? { ...item, status: 'Paid' } : item)));
  };

  const renderSkeletons = () =>
    Array.from({ length: 4 }).map((_, index) => (
      <div key={`skeleton-${index}`} className="payroll-skeleton-card">
        <div className="payroll-skeleton payroll-skeleton--icon"></div>
        <div className="payroll-skeleton payroll-skeleton--line"></div>
        <div className="payroll-skeleton payroll-skeleton--value"></div>
      </div>
    ));

  return (
    <section className="payroll-dashboard animate-fade-in">
      <header className="payroll-hero">
        <div>
          <span className="payroll-hero__eyebrow">Compensation Control Center</span>
          <h1>Payroll Management</h1>
          <p>Manage employee salaries, bonuses, and deductions</p>
        </div>
        <div className="payroll-hero__pill">
          <span>Payroll cycle</span>
          <strong>{month}</strong>
        </div>
      </header>

      <section className="payroll-filters">
        <div className="payroll-search">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            type="search"
            placeholder="Search employee or ID"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            aria-label="Search payroll employees"
          />
        </div>

        <div className="payroll-filter">
          <label htmlFor="department-filter">Department</label>
          <select id="department-filter" value={department} onChange={(event) => setDepartment(event.target.value)}>
            {departmentOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>

        <div className="payroll-filter">
          <label htmlFor="status-filter">Status</label>
          <select id="status-filter" value={status} onChange={(event) => setStatus(event.target.value)}>
            {statusOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>

        <div className="payroll-filter">
          <label htmlFor="month-filter">Month</label>
          <select id="month-filter" value={month} onChange={(event) => setMonth(event.target.value)}>
            {monthOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>

        <div className="payroll-filter-actions">
          <button type="button" className="payroll-button payroll-button--primary" onClick={handleRunPayroll}>
            Run Payroll
          </button>
          <button type="button" className="payroll-button payroll-button--secondary" onClick={handleExportCsv}>
            Export CSV
          </button>
        </div>
      </section>

      <section className="payroll-summary-grid">
        {loading ? (
          renderSkeletons()
        ) : (
          <>
            <PayrollCard title="Total Employees" value={summary.totalEmployees} caption="Active records in selected cycle" tone="indigo" icon={summaryIcons.employees} />
            <PayrollCard title="Total Salary Paid" value={formatCurrency(summary.totalSalaryPaid)} caption="Net payouts already processed" tone="emerald" icon={summaryIcons.salary} />
            <PayrollCard title="Pending Payments" value={formatCurrency(summary.pendingPayments)} caption="Awaiting payroll release" tone="amber" icon={summaryIcons.pending} />
            <PayrollCard title="Bonuses Distributed" value={formatCurrency(summary.bonusesDistributed)} caption="Performance and retention bonuses" tone="rose" icon={summaryIcons.bonus} />
          </>
        )}
      </section>

      <section className="payroll-chart-grid">
        <article className="payroll-panel payroll-panel--chart">
          <div className="payroll-panel__header">
            <div>
              <span>Analytics</span>
              <h2>Payroll distribution overview</h2>
            </div>
            <button type="button" className="payroll-button payroll-button--ghost">
              View report
            </button>
          </div>
          <div className="payroll-chart-placeholder">
            <div className="payroll-chart-placeholder__bars">
              <span></span>
              <span></span>
              <span></span>
              <span></span>
              <span></span>
            </div>
            <p>Chart module ready for integration with Recharts or Chart.js.</p>
          </div>
        </article>

        <article className="payroll-panel payroll-panel--insight">
          <div className="payroll-panel__header">
            <div>
              <span>Highlights</span>
              <h2>Payroll pulse</h2>
            </div>
          </div>
          <div className="payroll-insights">
            <div>
              <span>Processed</span>
              <strong>{filteredEmployees.filter((employee) => employee.status === 'Paid').length}</strong>
            </div>
            <div>
              <span>Pending approvals</span>
              <strong>{filteredEmployees.filter((employee) => employee.status === 'Pending').length}</strong>
            </div>
            <div>
              <span>Average net salary</span>
              <strong>{formatCurrency(filteredEmployees.length ? Math.round(filteredEmployees.reduce((sum, employee) => sum + employee.netSalary, 0) / filteredEmployees.length) : 0)}</strong>
            </div>
          </div>
        </article>
      </section>

      <section className="payroll-panel payroll-panel--table">
        <div className="payroll-panel__header">
          <div>
            <span>Payroll register</span>
            <h2>Salary statements and payment actions</h2>
          </div>
        </div>

        {loading ? (
          <div className="payroll-table-skeleton">
            <div className="payroll-skeleton payroll-skeleton--header"></div>
            <div className="payroll-skeleton payroll-skeleton--row"></div>
            <div className="payroll-skeleton payroll-skeleton--row"></div>
            <div className="payroll-skeleton payroll-skeleton--row"></div>
            <div className="payroll-skeleton payroll-skeleton--row"></div>
          </div>
        ) : (
          <PayrollTable
            employees={filteredEmployees}
            onView={setSelectedEmployee}
            onEdit={setSelectedEmployee}
            onPay={handlePayEmployee}
          />
        )}
      </section>

      <PayrollModal employee={selectedEmployee} isOpen={Boolean(selectedEmployee)} onClose={() => setSelectedEmployee(null)} />
    </section>
  );
};

export default PayrollPage;
