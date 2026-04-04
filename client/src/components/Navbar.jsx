import React, { useState, useRef, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useSocket } from '../context/SocketContext';
import { Link } from 'react-router-dom';
import NotificationPanel from './NotificationPanel';
import { ASSET_BASE_URL } from '../utils/api';
import './Navbar.css';

const Navbar = ({ toggleSidebar }) => {
  const { user } = useSelector((state) => state.auth);
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useSocket() || { notifications: [], unreadCount: 0 };
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  const handleNotificationClick = (notification) => {
    if (!notification.isRead) {
      markAsRead(notification._id);
    }
    setShowDropdown(false);
  };

  return (
    <nav className="navbar glass-panel">
      <div className="navbar-brand-mobile">
        <button className="menu-btn" onClick={toggleSidebar}>
          ☰
        </button>
        <h2>HRMS</h2>
      </div>
      <div className="navbar-actions">
        {/* Notifications */}
        <div className="notification-container" ref={dropdownRef}>
          <button 
            id="notification-bell-btn"
            className="notification-btn" 
            onClick={() => setShowDropdown(!showDropdown)}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
            {unreadCount > 0 && <span className="notification-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
          </button>
          
          <NotificationPanel 
            isOpen={showDropdown} 
            onClose={() => setShowDropdown(false)} 
          />
        </div>

        <Link to={`/${user?.role}/profile`} className="user-profile-menu" style={{ textDecoration: 'none', color: 'inherit' }}>
           {user?.avatar && user.avatar !== 'default-avatar.png' ? (
             <img src={`${ASSET_BASE_URL}${user.avatar}`} alt="Avatar" className="avatar-img" />
           ) : (
             <div className="avatar-placeholder">{user?.name?.charAt(0).toUpperCase() || 'U'}</div>
           )}
           <span className="navbar-user-name">{user?.name}</span>
        </Link>
      </div>
    </nav>
  );
};

export default Navbar;
