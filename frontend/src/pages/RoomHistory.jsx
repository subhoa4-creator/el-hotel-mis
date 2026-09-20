import { useEffect, useState } from 'react'
import api from '../api'

export default function RoomHistory() {
  const [branches, setBranches] = useState([])
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({
    branch_id: '',
    from_date: '',
    rooms: 0,
    notes: '',
  })

  const load = async () => {
    setLoading(true)
    try {
      const [b, h] = await Promise.all([
        api.get('/api/branches/'),
        api.get('/api/room-history/'),
      ])
      setBranches(b.data)
      setHistory(h.data)
      if (b.data.length && !form.branch_id) {
        setForm((prev) => ({ ...prev, branch_id: b.data[0].id }))
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const startAdd = () => {
    setForm({
      branch_id: branches[0]?.id || '',
      from_date: '',
      rooms: 0,
      notes: '',
    })
    setEditingId(null)
    setShowAdd(true)
    setMessage('')
  }

  const startEdit = (h) => {
    setForm({
      branch_id: h.branch_id,
      from_date: h.from_date,
      rooms: h.rooms,
      notes: h.notes || '',
    })
    setEditingId(h.id)
    setShowAdd(false)
    setMessage('')
  }

  const cancel = () => {
    setEditingId(null)
    setShowAdd(false)
    setForm({
      branch_id: branches[0]?.id || '',
      from_date: '',
      rooms: 0,
      notes: '',
    })
    setMessage('')
  }

  const save = async () => {
    if (!form.branch_id || !form.from_date) {
      setMessage('✗ Branch and Date are required')
      return
    }
    setSaving(true)
    setMessage('')
    try {
      const payload = {
        branch_id: Number(form.branch_id),
        from_date: form.from_date,
        rooms: Number(form.rooms) || 0,
        notes: form.notes || null,
      }
      if (editingId) {
        await api.put(`/api/room-history/${editingId}`, payload)
        setMessage('✓ Updated')
      } else {
        await api.post('/api/room-history/', payload)
        setMessage('✓ Added')
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

  const remove = async (h) => {
    if (!window.confirm(`Delete this entry? This cannot be undone.`)) return
    try {
      await api.delete(`/api/room-history/${h.id}`)
      setHistory((prev) => prev.filter((x) => x.id !== h.id))
      setMessage('✓ Deleted')
      setTimeout(() => setMessage(''), 2500)
    } catch (err) {
      setMessage('✗ ' + (err.response?.data?.detail || 'Failed'))
    }
  }

  const branchName = (id) => branches.find((b) => b.id === id)?.name || '?'

  // Group history by branch for display
  const byBranch = {}
  history.forEach((h) => {
    if (!byBranch[h.branch_id]) byBranch[h.branch_id] = []
    byBranch[h.branch_id].push(h)
  })
  Object.keys(byBranch).forEach((k) => {
    byBranch[k].sort((a, b) => a.from_date.localeCompare(b.from_date))
  })

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Room History</h1>
          <p className="text-slate-500 text-sm">
            Track when each branch's room count changes. Past months keep old
            counts automatically.
          </p>
        </div>
        {!showAdd && !editingId && (
          <button onClick={startAdd} className="btn btn-primary">
            + Add Change
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
            {editingId ? 'Edit Room Change' : 'New Room Change'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="label">Branch *</label>
              <select
                className="input"
                value={form.branch_id}
                onChange={(e) =>
                  setForm({ ...form, branch_id: e.target.value })
                }
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Effective From *</label>
              <input
                type="date"
                className="input"
                value={form.from_date}
                onChange={(e) =>
                  setForm({ ...form, from_date: e.target.value })
                }
              />
            </div>
            <div>
              <label className="label">Rooms</label>
              <input
                type="number"
                className="input"
                value={form.rooms}
                onChange={(e) => setForm({ ...form, rooms: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-1">
              <label className="label">Notes</label>
              <input
                className="input"
                value={form.notes}
                onChange={(e) =>
                  setForm({ ...form, notes: e.target.value })
                }
                placeholder="e.g., Extension"
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
        <div className="text-center py-10 text-slate-500">Loading…</div>
      ) : history.length === 0 ? (
        <div className="card text-center py-10 text-slate-500">
          No room history yet. Tap "+ Add Change" to record.
        </div>
      ) : (
        Object.entries(byBranch).map(([branchId, items]) => (
          <div className="card" key={branchId}>
            <h3 className="font-semibold mb-3">{branchName(Number(branchId))}</h3>
            <div className="overflow-x-auto">
              <table className="table-clean">
                <thead>
                  <tr>
                    <th>From Date</th>
                    <th className="text-right">Rooms</th>
                    <th>Notes</th>
                    <th className="text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((h) => (
                    <tr key={h.id}>
                      <td>{h.from_date}</td>
                      <td className="text-right font-medium">{h.rooms}</td>
                      <td className="text-slate-500 text-sm">
                        {h.notes || '—'}
                      </td>
                      <td className="text-center whitespace-nowrap">
                        <button
                          onClick={() => startEdit(h)}
                          className="btn btn-ghost text-sm px-2"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => remove(h)}
                          className="btn btn-ghost text-rose-600 text-sm px-2"
                        >
                          🗑
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}

      <div className="text-xs text-slate-500 px-2">
        When you change a branch's rooms, past months keep using the old count.
        Only months from the effective date onward use the new count.
      </div>
    </div>
  )
}
