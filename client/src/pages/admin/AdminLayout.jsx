import React, { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import AdminDashboard from './AdminDashboard';
import Employees from './Employees';
import Leaves from './Leaves';
import UploadDocument from './UploadDocument';
import GenerateDocument from './GenerateDocument';
import AttendanceAdmin from './AttendanceAdmin';
import Tasks from './Tasks';
import SalaryAdmin from './SalaryAdmin';
import Reports from './Reports';
import PendingApprovals from './PendingApprovals';
import Profile from '../shared/Profile';
import Chat from '../employee/Chat';
import './Admin.css';

const adminLinks = [
  { path: '/admin', label: 'Dashboard', exact: true, icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { path: '/admin/employees', label: 'Employees', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
  { path: '/admin/attendance', label: 'Attendance', icon: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z' },
  { path: '/admin/pending-approvals', label: 'Pending Approvals', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
  { path: '/admin/salary', label: 'Salary', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { path: '/admin/tasks', label: 'Tasks', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
  { path: '/admin/chat', label: 'Messages', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
  { path: '/admin/leaves', label: 'Leave Requests', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { path: '/admin/documents', label: 'Upload Docs', icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12' },
  { path: '/admin/reports', label: 'Reports', icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { path: '/admin/generate-offer', label: 'Generate Offer', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { path: '/admin/profile', label: 'My Profile', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' }
];

const AdminLayout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="layout-container">
      <Sidebar links={adminLinks} isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      <div className="main-content-wrapper">
        <Navbar toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<AdminDashboard />} />
            <Route path="/employees" element={<Employees />} />
            <Route path="/attendance" element={<AttendanceAdmin />} />
            <Route path="/pending-approvals" element={<PendingApprovals />} />
            <Route path="/salary" element={<SalaryAdmin />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/leaves" element={<Leaves />} />
            <Route path="/documents" element={<UploadDocument />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/generate-offer" element={<GenerateDocument />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/profile/:id" element={<Profile />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
