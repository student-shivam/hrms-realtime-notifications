import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import { useSelector } from 'react-redux';
import api, { SOCKET_URL } from '../utils/api';

const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const socketRef = useRef(null);
  const { user, token } = useSelector((state) => state.auth);
  const isAuthenticated = Boolean(user && token);

  const fetchNotifications = useCallback(async () => {
    try {
      if (!isAuthenticated) return;
      const res = await api.get('/notifications');
      setNotifications(res.data.data);
      setUnreadCount(res.data.unreadCount);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setSocket(null);
      return undefined;
    }

    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    const newSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 10000
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log(`Connected to socket server at ${SOCKET_URL}`);
      newSocket.emit('register', { userId: user._id || user.id, role: user.role });
    });

    newSocket.on('connect_error', (error) => {
      console.error(`Socket connection error (${SOCKET_URL}):`, error.message);
    });

    newSocket.on('disconnect', (reason) => {
      console.error('Socket disconnected:', reason);
    });

    newSocket.on('error', (error) => {
      console.error('Socket runtime error:', error?.message || error);
    });

    newSocket.on('newNotification', (notification) => {
      setNotifications((prev) => [notification, ...prev]);
      setUnreadCount((prev) => prev + 1);
    });

    fetchNotifications();

    return () => {
      newSocket.disconnect();
      if (socketRef.current === newSocket) {
        socketRef.current = null;
      }
      setSocket(null);
    };
  }, [isAuthenticated, user, token, fetchNotifications]);

  const markAsRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, isRead: true } : n)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  return (
    <SocketContext.Provider value={{ socket, notifications, unreadCount, markAsRead, markAllAsRead }}>
      {children}
    </SocketContext.Provider>
  );
};
