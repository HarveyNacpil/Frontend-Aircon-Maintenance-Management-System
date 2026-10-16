import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi, getAuthToken, getStoredUser } from '../services/api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getStoredUser());
  const [token, setToken] = useState(getAuthToken());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const login = async (username, password) => {
    setLoading(true);
    setError(null);
    try {
      const data = await authApi.login(username, password);
      const userObj = {
        userId: data.userId || 1,
        username: data.username || username,
        role: data.role || 'Staff',
      };
      setUser(userObj);
      setToken(data.token);
      return data;
    } catch (err) {
      setError(err.message || 'Login failed.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    authApi.logout();
    setUser(null);
    setToken(null);
  };

  const registerUser = async (formData) => {
    setLoading(true);
    setError(null);
    try {
      const data = await authApi.registerUser(formData);
      if (data.token) {
        setToken(data.token);
        setUser({ userId: data.userId, username: data.username, role: data.role });
      }
      return data;
    } catch (err) {
      setError(err.message || 'Registration failed.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = user?.role === 'Admin';
  const isTechnician = user?.role === 'Technician';
  const isStaff = user?.role === 'Staff';

  return (
    <AuthContext.Provider value={{ user, token, loading, error, login, logout, registerUser, isAdmin, isTechnician, isStaff }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
