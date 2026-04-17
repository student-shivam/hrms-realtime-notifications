import React from 'react';

const iconPaths = {
  menu: (
    <>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 11a8 8 0 1 0 2.34 5.66" />
      <path d="M20 4v7h-7" />
    </>
  ),
  attendance: (
    <>
      <path d="M7 4h10" />
      <path d="M7 8h10" />
      <path d="M7 12h4" />
      <path d="m15 14 2 2 4-4" />
      <rect x="3" y="3" width="18" height="18" rx="4" />
    </>
  ),
};

function HeaderIcon({ name, className = '' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {iconPaths[name]}
    </svg>
  );
}

const ProfileHeader = ({
  name,
  roleLabel,
  attendanceRate,
  avatar,
  onRefresh,
  refreshing,
}) => {
  const initial = name?.charAt(0)?.toUpperCase() || 'U';

  return (
    <header className="profile-dashboard-header">
      <div className="profile-header-topbar">
        <button type="button" className="profile-icon-button" aria-label="Open navigation menu">
          <HeaderIcon name="menu" />
        </button>

        <div className="profile-header-actions">
          <button
            type="button"
            className={`profile-icon-button ${refreshing ? 'is-refreshing' : ''}`}
            aria-label="Refresh dashboard"
            onClick={onRefresh}
          >
            <HeaderIcon name="refresh" />
          </button>

          <div className="profile-avatar-chip">
            {avatar ? (
              <img src={avatar} alt={name} className="profile-avatar-image" />
            ) : (
              <span>{initial}</span>
            )}
          </div>
        </div>
      </div>

      <div className="profile-header-main">
        <div className="profile-header-identity">
          <div className="profile-hero-avatar">
            {avatar ? (
              <img src={avatar} alt={name} className="profile-avatar-image" />
            ) : (
              <span>{initial}</span>
            )}
          </div>

          <div className="profile-header-copy">
            <p>My Dashboard</p>
            <span>{roleLabel}</span>
            <h1>{name}</h1>
          </div>
        </div>

        <div className="profile-attendance-highlight">
          <HeaderIcon name="attendance" className="profile-highlight-icon" />
          <strong>{attendanceRate}%</strong>
          <span>Attendance Rate</span>
        </div>
      </div>
    </header>
  );
};

export default ProfileHeader;
