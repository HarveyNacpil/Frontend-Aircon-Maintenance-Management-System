import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { notificationsApi } from '../services/api';
import { useAuth } from './AuthContext';

const NotificationContext = createContext();

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshNotifications = useCallback(async () => {
    if (!user?.userId) return;
    try {
      const list = await notificationsApi.getByUser(user.userId);
      setNotifications(Array.isArray(list) ? list : []);
      const countRes = await notificationsApi.getUnreadCount(user.userId);
      setUnreadCount(countRes.count ?? list.filter(n => !n.isRead).length);
    } catch (err) {
      console.warn('Failed to load notifications:', err);
    }
  }, [user]);

  useEffect(() => {
    refreshNotifications();
  }, [refreshNotifications]);

  const markAsRead = async (id) => {
    try {
      await notificationsApi.markAsRead(id);
      setNotifications(prev => prev.map(n => n.notificationId === id ? { ...n, isRead: 1 } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Mark notification read failed:', err);
    }
  };

  const markAllAsRead = async () => {
    if (!user?.userId) return;
    try {
      await notificationsApi.markAllAsRead(user.userId);
      setNotifications(prev => prev.map(n => ({ ...n, isRead: 1 })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Mark all read failed:', err);
    }
  };

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markAsRead, markAllAsRead, refreshNotifications }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
