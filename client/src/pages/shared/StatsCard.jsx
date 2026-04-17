import React from 'react';

const iconPaths = {
  present: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12 2.3 2.3 4.7-4.8" />
    </>
  ),
  absent: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m9 9 6 6" />
      <path d="m15 9-6 6" />
    </>
  ),
  leave: (
    <>
      <path d="M7 3v3" />
      <path d="M17 3v3" />
      <rect x="4" y="5" width="16" height="15" rx="3" />
      <path d="M4 10h16" />
    </>
  ),
  rate: (
    <>
      <path d="m6 18 12-12" />
      <circle cx="8.5" cy="8.5" r="2.5" />
      <circle cx="15.5" cy="15.5" r="2.5" />
    </>
  ),
};

function StatIcon({ name }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {iconPaths[name]}
    </svg>
  );
}

const StatsCard = ({ stats }) => (
  <section className="profile-stats-card">
    {stats.map((stat) => (
      <article key={stat.label} className="profile-stat-tile">
        <div className={`profile-stat-icon tone-${stat.tone}`}>
          <StatIcon name={stat.icon} />
        </div>
        <strong>{stat.value}</strong>
        <span>{stat.label}</span>
      </article>
    ))}
  </section>
);

export default StatsCard;
