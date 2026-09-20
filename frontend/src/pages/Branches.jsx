import { useEffect, useState } from 'react'
import api from '../api'

const EMPTY_BRANCH = {
  name: '',
  rooms: 0,
  rent: 0,
  electricity: 0,
  dg_cost: 0,
  housekeeping: 0,
  home_amenities: 0,
  is_head_office: 0,
  start_date: '',
  running_cost_per_room: 0,
}

export default function Branches() {
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_BRANCH)
  const [showAdd, setShowAdd] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.get('/api/branches/')
      setBranches(res.data)
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
    setForm({ ...EMPTY_BRANCH, start_date: '2026-04-01' })
    setEditingId(null)
    setShowAdd(true)
    setMessage('')
  }

  const startEdit = (branch) => {
    setForm({
      ...branch,
      start_date: branch.start_date || '',
      running_cost_per_room: branch.running_cost_per_room || 0,
    })
    setEditingId(branch.id)
    setShowAdd(false)
    setMessage('')
  }

  const cancel = () => {
    setEditingId(null)
    setShowAdd(false)
    setForm(EMPTY_BRANCH)
    setMessage('')
  }

  const save = async () => {
    if (!form.name.trim()) {
      setMessage('✗ Branch name is required')
      return
    }
    setSaving(true)
    setMessage('')
    try {
      const payload = {
        name: form.name.trim(),
        rooms: Number(form.rooms) || 0,
        rent: Number(form.rent) || 0,
        electricity: Number(form.electricity) || 0,
        dg_cost: Number(form.dg_cost) || 0,
        housekeeping: Number(form.housekeeping) || 0,
        home_amenities: Number(form.home_amenities) || 0,
        is_head_office: Number(form.is_head_office) || 0,
        start_date: form.start_date || null,
        running_cost_per_room: Number(form.running_cost_per_room) || 0,
      }
      if (editingId) {
        await api.put(`/api/branches/${editingId}`, payload)
        setMessage('✓ Branch updated')
      } else {
        await api.post('/api/branches/', payload)
        setMessage('✓ Branch added')
      }
      await load()
      cancel()
      setTimeout(() => setMessage(''), 2500)
    } catch (err) {
      setMessage(
        '✗ ' + (err.response?.data?.detail || 'Failed to save')
      )
    } finally {
      setSaving(false)
    }
  }

  const remove = async (branch) => {
    if (
      !window.confirm(
        `Delete branch "${branch.name}"? This cannot be undone.`
      )
    )
      return
    try {
      await api.delete(`/api/branches/${branch.id}`)
      setBranches((prev) => prev.filter((b) => b.id !== branch.id))
      setMessage('✓ Branch deleted')
      setTimeout(() => setMessage(''), 2500)
    } catch (err) {
      setMessage('✗ ' + (err.response?.data?.detail || 'Failed to delete'))
    }
  }

  const money = (v) =>
    '₹' +
    (Number(v) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Branches</h1>
          <p className="text-slate-500 text-sm">
            Manage branches, start dates, and cost parameters
          </p>
        </div>
        {!showAdd && !editingId && (
          <button onClick={startAdd} className="btn btn-primary">
            + Add Branch
          </button>
        )}
      </div>

      {message && (
        <div
          className={`text-sm ${
            message.startsWith('✓') ? 'text-emerald-600' : 'text-rose-600'
          }`}
        >
          {message}
        </div>
      )}

      {(showAdd || editingId) && (
        <div className="card border-blue-200 bg-blue-50/40">
          <h3 className="font-semibold mb-3">
            {editingId ? 'Edit Branch' : 'New Branch'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="sm:col-span-2">
              <label className="label">Branch Name *</label>
              <input
                className="input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., 7 N Seas"
              />
            </div>
            <div>
              <label className="label">Start Date</label>
              <input
                type="date"
                className="input"
                value={form.start_date || ''}
                onChange={(e) =>
                  setForm({ ...form, start_date: e.target.value })
                }
              />
            </div>
            <div>
              <label className="label">Head Office?</label>
              <select
                className="input"
                value={form.is_head_office}
                onChange={(e) =>
                  setForm({ ...form, is_head_office: e.target.value })
                }
              >
                <option value={0}>No (regular branch)</option>
                <option value={1}>Yes (Head Office)</option>
              </select>
            </div>
            <div>
              <label className="label">No. of Rooms</label>
              <input
                type="number"
                className="input"
                value={form.rooms}
                onChange={(e) => setForm({ ...form, rooms: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Monthly Rent</label>
              <input
                type="number"
                className="input"
                value={form.rent}
                onChange={(e) => setForm({ ...form, rent: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Electricity</label>
              <input
                type="number"
                className="input"
                value={form.electricity}
                onChange={(e) =>
                  setForm({ ...form, electricity: e.target.value })
                }
              />
            </div>
            <div>
              <label className="label">DG Cost</label>
              <input
                type="number"
                className="input"
                value={form.dg_cost}
                onChange={(e) =>
                  setForm({ ...form, dg_cost: e.target.value })
                }
              />
            </div>
            <div>
              <label className="label">Housekeeping</label>
              <input
                type="number"
                className="input"
                value={form.housekeeping}
                onChange={(e) =>
                  setForm({ ...form, housekeeping: e.target.value })
                }
              />
            </div>
            <div>
              <label className="label">Home Amenities / Room</label>
              <input
                type="number"
                className="input"
                value={form.home_amenities}
                onChange={(e) =>
                  setForm({ ...form, home_amenities: e.target.value })
                }
              />
            </div>
            <div>
              <label className="label">Running Cost per Room</label>
              <input
                type="number"
                className="input"
                value={form.running_cost_per_room}
                onChange={(e) =>
                  setForm({
                    ...form,
                    running_cost_per_room: e.target.value,
                  })
                }
              />
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
        <div className="text-center py-10 text-slate-500">
          Loading branches…
        </div>
      ) : branches.length === 0 ? (
        <div className="card text-center py-10 text-slate-500">
          No branches yet. Tap "+ Add Branch" to create one.
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table-clean min-w-[900px]">
            <thead>
              <tr>
                <th>Name</th>
                <th>Start Date</th>
                <th className="text-right">Rooms</th>
                <th className="text-right">Rent</th>
                <th className="text-right">Running/Room</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {branches.map((b) => (
                <tr key={b.id}>
                  <td className="font-medium">
                    {b.name}
                    {b.is_head_office ? (
                      <span className="badge badge-blue ml-2">HO</span>
                    ) : null}
                  </td>
                  <td className="text-slate-600">
                    {b.start_date || '—'}
                  </td>
                  <td className="text-right">{b.rooms}</td>
                  <td className="text-right">{money(b.rent)}</td>
                  <td className="text-right">
                    {money(b.running_cost_per_room)}
                  </td>
                  <td className="text-center whitespace-nowrap">
                    <button
                      onClick={() => startEdit(b)}
                      className="btn btn-ghost text-sm px-2"
                      title="Edit"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => remove(b)}
                      className="btn btn-ghost text-rose-600 text-sm px-2"
                      title="Delete"
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
    </div>
  )
}
