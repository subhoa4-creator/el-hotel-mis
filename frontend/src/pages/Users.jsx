import { useEffect, useState } from 'react'
import api from '../api'

const ROLES = ['admin', 'accounts', 'manager', 'viewer']

const EMPTY_USER = {
  email: '',
  name: '',
  password: '',
  role: 'manager',
  branch_id: '',
}

export default function Users() {
  const [users, setUsers] = useState([])
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_USER)
  const [showAdd, setShowAdd] = useState(false)

  const me = JSON.parse(localStorage.getItem('user') || '{}')

  const load = async () => {
    setLoading(true)
    try {
      const [u, b] = await Promise.all([
        api.get('/api/users/'),
        api.get('/api/branches/'),
      ])
      setUsers(u.data)
      setBranches(b.data)
    } catch (err) {
      setMessage('✗ ' + (err.response?.data?.detail || 'Failed to load'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const startAdd = () => {
    setForm(EMPTY_USER)
    setEditingId(null)
    setShowAdd(true)
    setMessage('')
  }

  const startEdit = (u) => {
    setForm({
      email: u.email,
      name: u.name,
      password: '',
      role: u.role,
      branch_id: u.branch_id || '',
    })
    setEditingId(u.id)
    setShowAdd(false)
    setMessage('')
  }

  const cancel = () => {
    setEditingId(null)
    setShowAdd(false)
    setForm(EMPTY_USER)
    setMessage('')
  }

  const save = async () => {
    if (!form.email.trim() || !form.name.trim()) {
      setMessage('✗ Email and Name are required')
      return
    }
    if (!editingId && !form.password) {
      setMessage('✗ Password is required for new users')
      return
    }
    setSaving(true)
    setMessage('')
    try {
      if (editingId) {
        const payload = {
          email: form.email.trim(),
          name: form.name.trim(),
          role: form.role,
          branch_id: form.branch_id === '' ? null : Number(form.branch_id),
        }
        if (form.password) payload.password = form.password
        await api.put(`/api/users/${editingId}`, payload)
        setMessage('✓ User updated')
      } else {
        await api.post('/api/users/', {
          email: form.email.trim(),
          name: form.name.trim(),
          password: form.password,
          role: form.role,
          branch_id: form.branch_id === '' ? null : Number(form.branch_id),
        })
        setMessage('✓ User created')
      }
      await load()
      cancel()
      setTimeout(() => setMessage(''), 2500)
    } catch (err) {
      setMessage('✗ ' + (err.response?.data?.detail || 'Failed to save'))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (u) => {
    if (u.email === me.email) {
      alert('You cannot delete your own account.')
      return
    }
    if (!window.confirm(`Delete user "${u.email}"?`)) return
    try {
      await api.delete(`/api/users/${u.id}`)
      setUsers((prev) => prev.filter((x) => x.id !== u.id))
      setMessage('✓ User deleted')
      setTimeout(() => setMessage(''), 2500)
    } catch (err) {
      setMessage('✗ ' + (err.response?.data?.detail || 'Failed'))
    }
  }

  const branchName = (id) => {
    if (!id) return '—'
    const b = branches.find((x) => x.id === id)
    return b ? b.name : '—'
  }

  const roleBadge = (role) => {
    const colors = {
      admin: 'bg-rose-100 text-rose-700',
      accounts: 'bg-blue-100 text-blue-700',
      manager: 'bg-emerald-100 text-emerald-700',
      viewer: 'bg-slate-100 text-slate-600',
    }
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[role] || 'bg-slate-100 text-slate-600'}`}>
        {role}
      </span>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-slate-500 text-sm">
            Manage user accounts and access roles
          </p>
        </div>
        {!showAdd && !editingId && (
          <button onClick={startAdd} className="btn btn-primary">
            + Add User
          </button>
        )}
      </div>

      {message && (
        <div className={`text-sm ${message.startsWith('✓') ? 'text-emerald-600' : 'text-rose-600'}`}>
          {message}
        </div>
      )}

      {(showAdd || editingId) && (
        <div className="card border-blue-200 bg-blue-50/40">
          <h3 className="font-semibold mb-3">
            {editingId ? 'Edit User' : 'New User'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Email *</label>
              <input
                type="email"
                className="input"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="user@example.com"
              />
            </div>
            <div>
              <label className="label">Name *</label>
              <input
                className="input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Full name"
              />
            </div>
            <div>
              <label className="label">
                Password {editingId ? '(leave blank to keep)' : '*'}
              </label>
              <input
                type="password"
                className="input"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder={editingId ? 'New password (optional)' : 'Password'}
              />
            </div>
            <div>
              <label className="label">Role</label>
              <select
                className="input"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label">Branch (optional)</label>
              <select
                className="input"
                value={form.branch_id}
                onChange={(e) => setForm({ ...form, branch_id: e.target.value })}
              >
                <option value="">— None (all branches) —</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={cancel} className="btn btn-ghost">
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="btn btn-primary disabled:opacity-60"
            >
              {saving ? 'Saving…' : editingId ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-10 text-slate-500">Loading…</div>
      ) : users.length === 0 ? (
        <div className="card text-center py-10 text-slate-500">
          No users yet. Tap "+ Add User" to create one.
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table-clean min-w-[700px]">
            <thead>
              <tr>
                <th>Email</th>
                <th>Name</th>
                <th>Role</th>
                <th>Branch</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="font-medium">
                    {u.email}
                    {u.email === me.email ? (
                      <span className="badge badge-blue ml-2">You</span>
                    ) : null}
                  </td>
                  <td>{u.name}</td>
                  <td>{roleBadge(u.role)}</td>
                  <td className="text-slate-600">{branchName(u.branch_id)}</td>
                  <td className="text-center whitespace-nowrap">
                    <button
                      onClick={() => startEdit(u)}
                      className="btn btn-ghost text-sm px-2"
                      title="Edit"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => remove(u)}
                      disabled={u.email === me.email}
                      className="btn btn-ghost text-rose-600 text-sm px-2 disabled:opacity-30"
                      title={u.email === me.email ? 'Cannot delete yourself' : 'Delete'}
                    >
                      🗑
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="text-xs text-slate-500 px-2">
        <strong>Roles:</strong> admin (full access) · accounts (data entry + ledgers) ·
        manager (data entry) · viewer (view only)
      </div>
    </div>
  )
}
