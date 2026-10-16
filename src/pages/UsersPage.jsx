import React, { useState, useEffect } from 'react';
import { UserCheck, Plus, Search, Edit3, Trash2, Shield, Phone, Mail, CheckCircle2, XCircle } from 'lucide-react';
import { usersApi } from '../services/api';
import { Modal } from '../components/common/Modal';
import { Badge } from '../components/common/Badge';
import { PrimaryButton } from '../components/common/PrimaryButton';
import { PageHeader } from '../components/common/PageHeader';

export function UsersPage({ globalSearch }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    fullName: '',
    username: '',
    password: '',
    role: 'Technician',
    phone: '',
    email: '',
    status: 'Active',
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await usersApi.getAll();
      setUsers(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await usersApi.create(formData);
      setIsAddOpen(false);
      resetForm();
      await loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;
    try {
      await usersApi.update(selectedUser.userId, {
        ...formData,
        userId: selectedUser.userId,
        newPassword: formData.password || undefined,
      });
      setIsEditOpen(false);
      setSelectedUser(null);
      await loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this system user account?')) return;
    try {
      await usersApi.delete(id);
      await loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const resetForm = () => {
    setFormData({
      fullName: '',
      username: '',
      password: '',
      role: 'Technician',
      phone: '',
      email: '',
      status: 'Active',
    });
  };

  const openEditModal = (u) => {
    setSelectedUser(u);
    setFormData({
      fullName: u.fullName || '',
      username: u.username || '',
      password: '',
      role: u.role || 'Staff',
      phone: u.phone || '',
      email: u.email || '',
      status: u.status || 'Active',
    });
    setIsEditOpen(true);
  };

  const activeSearch = searchQuery || globalSearch;
  const filteredUsers = users.filter((u) => {
    const full = (u.fullName || '').toLowerCase();
    const uname = (u.username || '').toLowerCase();
    const role = (u.role || '').toLowerCase();
    const query = activeSearch.toLowerCase();

    return full.includes(query) || uname.includes(query) || role.includes(query);
  });

  return (
    <div className="w-full h-full flex flex-col min-h-0 overflow-hidden">
      {/* Static PageHeader */}
      <PageHeader
        icon={UserCheck}
        iconColor="text-indigo-500"
        title="User Administration & Roles"
        subtitle="Manage system staff accounts, assign roles, and toggle access statuses"
        searchQuery={searchQuery}
        onSearchChange={(e) => setSearchQuery(e.target.value)}
        searchPlaceholder="Search users by name, role..."
        actions={
          <PrimaryButton
            onClick={() => {
              resetForm();
              setIsAddOpen(true);
            }}
            className="shrink-0 text-xs py-1.5 px-3"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden xs:inline">Create New User</span>
            <span className="xs:hidden">Create User</span>
          </PrimaryButton>
        }
      />

      {/* Scrollable Content Container */}
      <div 
        className="flex-1 min-h-0 overflow-y-auto w-full" 
        style={{ backgroundColor: "var(--page-bg)", scrollbarGutter: 'stable' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-8">
          {/* Users Table Container */}
          <div 
            style={{
              backgroundColor: "var(--card-bg)",
              borderColor: "var(--border)",
            }}
            className="glass-panel rounded-3xl overflow-hidden shadow-xl border"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead 
                  style={{
                    backgroundColor: "var(--card-inner)",
                    borderColor: "var(--border)",
                    color: "var(--text-muted)",
                  }}
                  className="sticky top-0 z-10 backdrop-blur-md uppercase text-[10px] font-bold tracking-wider border-b shadow-sm"
                >
              <tr>
                <th className="px-6 py-4">User Details</th>
                <th className="px-6 py-4">Role Badge</th>
                <th className="px-6 py-4">Contact Info</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody 
              style={{ borderColor: "var(--border)" }}
              className="divide-y font-medium"
            >
              {loading ? (
                <tr>
                  <td colSpan={5} style={{ color: "var(--text-muted)" }} className="px-6 py-8 text-center">Loading user accounts...</td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ color: "var(--text-muted)" }} className="px-6 py-8 text-center">No users found.</td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr 
                    key={u.userId} 
                    style={{ borderColor: "var(--border)" }}
                    className="hover:opacity-90 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-white font-bold flex items-center justify-center text-xs shadow-md">
                          {u.username?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div>
                          <div style={{ color: "var(--text-primary)" }} className="font-semibold text-sm">
                            {u.fullName || u.username}
                          </div>
                          <div style={{ color: "var(--text-muted)" }} className="text-[10px] font-mono">@{u.username} (ID #{u.userId})</div>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <Badge variant={u.role}>{u.role}</Badge>
                    </td>

                    <td className="px-6 py-4 space-y-0.5">
                      <div style={{ color: "var(--text-primary)" }} className="font-medium">{u.phone || 'No phone'}</div>
                      <div style={{ color: "var(--text-muted)" }} className="text-[10px]">{u.email || 'No email'}</div>
                    </td>

                    <td className="px-6 py-4">
                      <Badge variant={u.status}>{u.status}</Badge>
                    </td>

                    <td className="px-6 py-4 text-right">
                      <div className="inline-flex items-center space-x-1">
                        <button
                          onClick={() => openEditModal(u)}
                          style={{ color: "var(--text-muted)" }}
                          className="p-2 rounded-xl hover:text-amber-500 transition-colors"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(u.userId)}
                          style={{ color: "var(--text-muted)" }}
                          className="p-2 rounded-xl hover:text-rose-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
        </div>
      </div>

      {/* Modal: Add User */}
      <Modal 
        isOpen={isAddOpen} 
        onClose={() => setIsAddOpen(false)} 
        title="Create System User Account"
        subtitle="Provision access credentials and designate system permissions"
        onSubmit={handleCreate}
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsAddOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-md transition-colors"
            >
              Create User
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Alex Rivera"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Username *</label>
            <input
              type="text"
              required
              placeholder="e.g. arivera"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Password *</label>
            <input
              type="password"
              required
              placeholder="Account password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Assigned Role</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="Admin">Admin (Full System Access)</option>
              <option value="Technician">Technician (Maintenance & Service Requests)</option>
              <option value="Staff">Staff (View Only & Service Booking)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Phone Number</label>
            <input
              type="text"
              placeholder="+1 555-0100"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
            <input
              type="email"
              placeholder="user@domain.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Account Status</label>
          <select
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
      </Modal>

      {/* Modal: Edit User */}
      <Modal 
        isOpen={isEditOpen} 
        onClose={() => setIsEditOpen(false)} 
        title="Edit User Account"
        subtitle="Modify staff details, role credentials, or account active state"
        onSubmit={handleUpdate}
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsEditOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs shadow-md transition-colors"
            >
              Update User
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
            <input
              type="text"
              required
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Username</label>
            <input
              type="text"
              required
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">New Password (Optional)</label>
            <input
              type="password"
              placeholder="Leave blank to keep current"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Role</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="Admin">Admin</option>
              <option value="Technician">Technician</option>
              <option value="Staff">Staff</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Phone</label>
            <input
              type="text"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Status</label>
          <select
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
      </Modal>
    </div>
  );
}
