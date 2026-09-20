import { useEffect, useState } from 'react'
import api from '../api'

export default function CostPerRoom() {
  const [branches, setBranches] = useState([])
  const [editing, setEditing] = useState({})
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const load = async () => {
    const res = await api.get('/api/branches/')
    setBranches(res.data)
  }

  useEffect(() => {
    load()
  }, [])

  const handleChange = (branchId, value) => {
    setEditing((prev) => ({ ...prev, [branchId]: value }))
  }

  const saveAll = async () => {
    setSaving(true)
    setMessage('')
    try {
      const updates = branches
        .filter((b) => editing[b.id] !== undefined)
        .map(async (b) => {
          const payload = { ...b, running_cost_per_room: Number(editing[b.id]) || 0 }
          delete payload.id
          await api.put(`/api/branches/${b.id}`, payload)
        })
      await Promise.all(updates)
      await load()
      setEditing({})
      setMessage('✓ Saved successfully')
    } catch (err) {
      setMessage(
        '✗ ' + (err.response?.data?.detail || 'Failed to save')
      )
    } finally {
      setSaving(false)
      setTimeout(() => setMessage(''), 3000)
    }
  }

  const hasChanges = Object.keys(editing).length > 0

  const money = (v) =>
    '₹' + (Number(v) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Cost per Room</h1>
          <p className="text-slate-500 text-sm">
            Enter running cost per room for each branch (one-time or update anytime)
          </p>
        </div>
        {hasChanges && (
          <button
            onClick={saveAll}
            disabled={saving}
            className="btn btn-primary disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save All Changes'}
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

      <div className="card overflow-x-auto">
        <table className="table-clean min-w-[500px]">
          <thead>
            <tr>
              <th>Branch</th>
              <th className="text-right">Current Value</th>
              <th className="text-right w-48">New Value</th>
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
                <td className="text-right text-slate-500">
                  {money(b.running_cost_per_room)}
                </td>
                <td className="text-right">
                  <input
                    type="number"
                    className="input text-right"
                    value={
                      editing[b.id] !== undefined
                        ? editing[b.id]
                        : b.running_cost_per_room || ''
                    }
                    onChange={(e) => handleChange(b.id, e.target.value)}
                    placeholder="0"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-slate-500 px-2">
        Changes are only saved when you tap <strong>Save All Changes</strong>.
      </div>
    </div>
  )
}
