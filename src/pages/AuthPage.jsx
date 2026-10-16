import React, { useState } from 'react';
import { Wind, Lock, User, ArrowRight, ServerOff, Sun, Moon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useApiHealth } from '../context/ApiHealthContext';
import { authApi } from '../services/api';

export function AuthPage({ theme, toggleTheme }) {
  const { login, registerUser, loading, error } = useAuth();
  const { isOnline } = useApiHealth();

  const [mode, setMode] = useState('login'); // 'login' | 'register' | 'forgot' | 'reset'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Register state
  const [regFullName, setRegFullName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');

  // Forgot / Reset state
  const [forgotUsername, setForgotUsername] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [infoMessage, setInfoMessage] = useState(null);

  const isLight = theme === 'light';

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setInfoMessage(null);
    try {
      await login(username, password);
    } catch {
      // handled by auth context
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setInfoMessage(null);
    try {
      await registerUser({
        fullName: regFullName,
        username: regUsername,
        password: regPassword,
        phone: regPhone,
        email: regEmail,
      });
    } catch {
      // handled by auth context
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setInfoMessage(null);
    try {
      const res = await authApi.forgotPassword(forgotUsername);
      setInfoMessage(res.message || 'Reset token generated if user exists.');
      if (res.resetToken) {
        setResetToken(res.resetToken);
        setMode('reset');
      }
    } catch (err) {
      setInfoMessage(err.message);
    }
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    setInfoMessage(null);
    try {
      const res = await authApi.resetPassword(resetToken, newPassword);
      setInfoMessage(res.message || 'Password reset successfully! Please log in.');
      setMode('login');
    } catch (err) {
      setInfoMessage(err.message);
    }
  };

  return (
    <div 
      style={{ backgroundColor: "var(--page-bg)", color: "var(--text-primary)" }}
      className="min-h-screen flex items-center justify-center p-4 sm:p-6 relative overflow-hidden transition-colors duration-200"
    >
      {/* Dynamic Animated Background Orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-sky-500/15 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none animate-pulse delay-1000" />

      {/* Top right theme toggle */}
      {toggleTheme && (
        <div className="absolute top-4 right-4 z-20">
          <button
            onClick={toggleTheme}
            style={{
              backgroundColor: "var(--card-bg)",
              borderColor: "var(--border)",
              color: "var(--text-primary)",
            }}
            className="p-2.5 rounded-xl border shadow-md hover:opacity-80 transition-all flex items-center justify-center"
            title={`Switch to ${isLight ? 'Dark' : 'Light'} Mode`}
            aria-label="Toggle theme"
          >
            {isLight ? <Moon className="w-4 h-4 text-sky-600" /> : <Sun className="w-4 h-4 text-amber-400" />}
          </button>
        </div>
      )}

      <div 
        style={{
          backgroundColor: "var(--card-bg)",
          borderColor: "var(--border)",
          boxShadow: "var(--shadow)",
        }}
        className="w-full max-w-md relative z-10 glass-panel p-8 rounded-3xl border shadow-2xl backdrop-blur-xl"
      >
        {/* Logo & Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-500 via-cyan-500 to-emerald-400 text-white shadow-xl shadow-sky-500/30 mb-3">
            <Wind className="w-8 h-8 animate-spin-slow" />
          </div>
          <h2 style={{ color: "var(--text-primary)" }} className="text-2xl font-black tracking-tight">
            AERO<span style={{ color: "var(--accent)" }}>FLOW</span>
          </h2>
          <p style={{ color: "var(--text-muted)" }} className="text-xs mt-1 font-medium">
            Next-Gen HVAC Fleet & Smart Maintenance Platform
          </p>
        </div>

        {/* Backend Offline Warning */}
        {!isOnline && (
          <div 
            style={{
              backgroundColor: "var(--status-danger-bg)",
              borderColor: "var(--status-danger-border)",
              color: "var(--status-danger-text)",
            }}
            className="mb-4 p-3 rounded-xl border text-xs font-medium flex items-center gap-2 animate-pulse"
          >
            <ServerOff className="w-4 h-4 shrink-0 text-rose-500" />
            <span>Backend API is offline. Start the backend with <code className="px-1.5 py-0.5 rounded font-mono font-bold">dotnet run</code> to sign in.</span>
          </div>
        )}

        {/* Info or Error Notifications */}
        {error && (
          <div 
            style={{
              backgroundColor: "var(--status-danger-bg)",
              borderColor: "var(--status-danger-border)",
              color: "var(--status-danger-text)",
            }}
            className="mb-4 p-3 rounded-xl border text-xs font-medium"
          >
            {error}
          </div>
        )}
        {infoMessage && (
          <div 
            style={{
              backgroundColor: "var(--status-info-bg)",
              borderColor: "var(--status-info-border)",
              color: "var(--status-info-text)",
            }}
            className="mb-4 p-3 rounded-xl border text-xs font-medium"
          >
            {infoMessage}
          </div>
        )}

        {/* Login Form */}
        {mode === 'login' && (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label htmlFor="login-username" style={{ color: "var(--text-primary)" }} className="block text-xs font-medium mb-1.5">Username</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: "var(--text-muted)" }} />
                <input
                  id="login-username"
                  name="username"
                  type="text"
                  required
                  autoFocus
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  style={{
                    backgroundColor: "var(--input-bg)",
                    borderColor: "var(--input-border)",
                    color: "var(--input-text)",
                  }}
                  className="w-full pl-10 pr-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="login-password" style={{ color: "var(--text-primary)" }} className="block text-xs font-medium">Password</label>
                <button
                  type="button"
                  onClick={() => setMode('forgot')}
                  className="text-xs text-sky-500 hover:text-sky-600 font-medium"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: "var(--text-muted)" }} />
                <input
                  id="login-password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  style={{
                    backgroundColor: "var(--input-bg)",
                    borderColor: "var(--input-border)",
                    color: "var(--input-text)",
                  }}
                  className="w-full pl-10 pr-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !isOnline}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-semibold text-sm shadow-lg shadow-sky-500/25 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>{!isOnline ? 'Backend Offline' : loading ? 'Signing In...' : 'Sign In'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="text-center pt-2">
              <span style={{ color: "var(--text-muted)" }} className="text-xs">Don't have an account? </span>
              <button
                type="button"
                onClick={() => setMode('register')}
                className="text-xs text-sky-500 hover:text-sky-600 font-semibold ml-1"
              >
                Register Here
              </button>
            </div>
          </form>
        )}

        {/* Public Self-Registration Form */}
        {mode === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="space-y-3">
            <div>
              <label style={{ color: "var(--text-primary)" }} className="block text-xs font-medium mb-1">Full Name</label>
              <input
                type="text"
                required
                autoComplete="name"
                value={regFullName}
                onChange={(e) => setRegFullName(e.target.value)}
                placeholder="Enter your full name"
                style={{
                  backgroundColor: "var(--input-bg)",
                  borderColor: "var(--input-border)",
                  color: "var(--input-text)",
                }}
                className="w-full px-3.5 py-2 border rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>
            <div>
              <label style={{ color: "var(--text-primary)" }} className="block text-xs font-medium mb-1">Username</label>
              <input
                type="text"
                required
                autoComplete="username"
                value={regUsername}
                onChange={(e) => setRegUsername(e.target.value)}
                placeholder="Choose username"
                style={{
                  backgroundColor: "var(--input-bg)",
                  borderColor: "var(--input-border)",
                  color: "var(--input-text)",
                }}
                className="w-full px-3.5 py-2 border rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>
            <div>
              <label style={{ color: "var(--text-primary)" }} className="block text-xs font-medium mb-1">Password</label>
              <input
                type="password"
                required
                autoComplete="new-password"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                placeholder="Choose password"
                style={{
                  backgroundColor: "var(--input-bg)",
                  borderColor: "var(--input-border)",
                  color: "var(--input-text)",
                }}
                className="w-full px-3.5 py-2 border rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>
            <div>
              <label style={{ color: "var(--text-primary)" }} className="block text-xs font-medium mb-1">Phone (Optional)</label>
              <input
                type="tel"
                autoComplete="tel"
                value={regPhone}
                onChange={(e) => setRegPhone(e.target.value)}
                placeholder="+1 555-0000"
                style={{
                  backgroundColor: "var(--input-bg)",
                  borderColor: "var(--input-border)",
                  color: "var(--input-text)",
                }}
                className="w-full px-3.5 py-2 border rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>
            <div>
              <label style={{ color: "var(--text-primary)" }} className="block text-xs font-medium mb-1">Email (Optional)</label>
              <input
                type="email"
                autoComplete="email"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                placeholder="email@domain.com"
                style={{
                  backgroundColor: "var(--input-bg)",
                  borderColor: "var(--input-border)",
                  color: "var(--input-text)",
                }}
                className="w-full px-3.5 py-2 border rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 mt-2 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-semibold text-sm transition-colors"
            >
              {loading ? 'Creating Account...' : 'Complete Staff Registration'}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setMode('login')}
                style={{ color: "var(--text-muted)" }}
                className="text-xs hover:opacity-80"
              >
                Back to Sign In
              </button>
            </div>
          </form>
        )}

        {/* Forgot Password View */}
        {mode === 'forgot' && (
          <form onSubmit={handleForgotSubmit} className="space-y-4">
            <p style={{ color: "var(--text-muted)" }} className="text-xs">
              Enter your username below. In development mode, a reset token will be generated immediately.
            </p>
            <div>
              <label style={{ color: "var(--text-primary)" }} className="block text-xs font-medium mb-1">Username</label>
              <input
                type="text"
                required
                autoComplete="username"
                value={forgotUsername}
                onChange={(e) => setForgotUsername(e.target.value)}
                placeholder="Your account username"
                style={{
                  backgroundColor: "var(--input-bg)",
                  borderColor: "var(--input-border)",
                  color: "var(--input-text)",
                }}
                className="w-full px-3.5 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-semibold text-sm rounded-xl transition-colors"
            >
              Generate Reset Token
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setMode('login')}
                style={{ color: "var(--text-muted)" }}
                className="text-xs hover:opacity-80"
              >
                Cancel and Return to Sign In
              </button>
            </div>
          </form>
        )}

        {/* Reset Password View */}
        {mode === 'reset' && (
          <form onSubmit={handleResetSubmit} className="space-y-4">
            <div>
              <label style={{ color: "var(--text-primary)" }} className="block text-xs font-medium mb-1">Reset Token</label>
              <input
                type="text"
                required
                autoComplete="one-time-code"
                value={resetToken}
                onChange={(e) => setResetToken(e.target.value)}
                style={{
                  backgroundColor: "var(--input-bg)",
                  borderColor: "var(--input-border)",
                  color: "var(--input-text)",
                }}
                className="w-full px-3.5 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>
            <div>
              <label style={{ color: "var(--text-primary)" }} className="block text-xs font-medium mb-1">New Password</label>
              <input
                type="password"
                required
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                style={{
                  backgroundColor: "var(--input-bg)",
                  borderColor: "var(--input-border)",
                  color: "var(--input-text)",
                }}
                className="w-full px-3.5 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm rounded-xl transition-colors"
            >
              Set New Password
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setMode('login')}
                style={{ color: "var(--text-muted)" }}
                className="text-xs hover:opacity-80"
              >
                Back to Sign In
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
