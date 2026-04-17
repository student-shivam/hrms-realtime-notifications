import React from 'react';

const PayrollCard = ({ title, value, caption, tone = 'indigo', icon }) => (
  <article className={`payroll-card payroll-card--${tone}`}>
    <div className="payroll-card__icon" aria-hidden="true">
      {icon}
    </div>
    <div className="payroll-card__content">
      <span className="payroll-card__title">{title}</span>
      <strong className="payroll-card__value">{value}</strong>
      <span className="payroll-card__caption">{caption}</span>
    </div>
  </article>
);

export default PayrollCard;
