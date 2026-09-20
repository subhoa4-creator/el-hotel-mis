import { useEffect, useState } from 'react'
import api from '../api'

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
]

export default function FoodCost() {
  const [branches, setBranches] = useState([])
  const [branchId, setBranchId] = useState('')
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [year, setYear] = useState(new Date().getFullYear())
  const [form, setForm] = useState({ staff_cost: 0, guest_cost: 0 })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    api.get('/api/branches/').then((res) => {
      setBranches(res.data)
      if (res.data.length) setBranchId(res.data[0].id)
    })
  }, [])

  useEffect(() => {
    if (!branchId) return
    setLoading(true)
    setMessage('')
    api
      .get('/api/food-costs/', {
        params: { branch_id: branchId, month, year },
      })
      .then((res) => {
        if (res.data.length) {
          setForm({
            staff_cost: res.data[0].staff_cost || 0,
            guest_cost: res.data[0].guest_cost || 0,
          })
        } else {
          setForm({ staff_cost: 0, guest_cost: 0 })
        }
      })
      .finally(() => setLoading(false))
  }, [branchId, month, year])

  const save = async () => {
    if (!branchId) return
    setSaving(true)
    setMessage('')
    try {
      await api.post('/api/food-costs/bulk', [
        {
          branch_id: Number(branchId),
          month: Number(month),
          year: Number(year),
          staff_cost: Number(form.staff_cost) || 0,
          guest_cost: Number(form.guest_cost) || 0,
        },
      ])
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Food Cost</h1>
        <p className="text-slate-500 text-sm">
          Enter staff food cost and guest food cost per month
        </p>
      </div>

      <div className="card grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="label">Branch</label>
          <select
            className="input"
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Month</label>
          <select
            className="input"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          >
            {MONTHS.map((m, i) => (
              <option key={i} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Year</label>
          <input
            type="number"
            className="input"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-10 text-slate-500">Loading…</div>
      ) : (
        <div className="card space-y-3">
          <div className="flex items-center gap-3 py-1">
            <label className="flex-1 text-sm">Staff Food Cost</label>
            <input
              type="number"
              className="input w-40 text-right"
              value={form.staff_cost}
              onChange={(e) =>
                setForm({ ...form, staff_cost: e.target.value })
              }
              placeholder="0"
            />
          </div>
          <div className="flex items-center gap-3 py-1">
            <label className="flex-1 text-sm">Guest Food Cost</label>
            <input
              type="number"
              className="input w-40 text-right"
              value={form.guest_cost}
              onChange={(e) =>
                setForm({ ...form, guest_cost: e.target.value })
              }
              placeholder="0"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t">
            {message && (
              <span
                className={`text-sm ${
                  message.startsWith('✓')
                    ? 'text-emerald-600'
                    : 'text-rose-600'
                }`}
              >
                {message}
              </span>
            )}
            <button
              onClick={save}
              disabled={saving}
              className="btn btn-primary disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
