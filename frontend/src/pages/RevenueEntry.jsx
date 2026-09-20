import { useEffect, useState } from 'react'
import api from '../api'

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
]

const daysInMonth = (year, month) => {
  // month: 1-12
  return new Date(year, month, 0).getDate()
}

const FIELDS = [
  { key: 'room_revenue', label: 'Room Revenue', type: 'money' },
  { key: 'fnb_revenue', label: 'Restaurant / F&B Revenue', type: 'money' },
  { key: 'other_income', label: 'Other Income', type: 'money' },
  { key: 'discount', label: 'Less: Discount Allowed', type: 'money' },
  { key: 'gst', label: 'GST Collected', type: 'money' },
  // rooms_available is now auto-computed — NOT user input
  { key: 'rooms_occupied', label: 'Rooms Occupied', type: 'int' },
  { key: 'pax_fnb', label: 'No. of Pax - FnB', type: 'int' },
]

export default function RevenueEntry() {
  const [branches, setBranches] = useState([])
  const [branchId, setBranchId] = useState('')
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [year, setYear] = useState(new Date().getFullYear())
  const [form, setForm] = useState({})
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
      .get('/api/revenue-entries/', {
        params: { branch_id: branchId, month, year },
      })
      .then((res) => {
        if (res.data.length) {
          setForm(res.data[0])
        } else {
          setForm({})
        }
      })
      .finally(() => setLoading(false))
  }, [branchId, month, year])

  const currentBranch = branches.find((b) => b.id === Number(branchId))
  const days = daysInMonth(year, month)
  const autoRoomsAvailable = currentBranch
    ? Number(currentBranch.rooms || 0) * days
    : 0

  const handleChange = (key, value) => {
    setForm((prev) => ({
      ...prev,
      [key]: value === '' ? '' : Number(value),
    }))
  }

  const handleSave = async () => {
    if (!branchId) return
    setSaving(true)
    setMessage('')
    try {
      const payload = {
        branch_id: Number(branchId),
        month: Number(month),
        year: Number(year),
        // rooms_available is set to auto-computed value
        rooms_available: autoRoomsAvailable,
      }
      FIELDS.forEach((f) => {
        payload[f.key] = Number(form[f.key]) || 0
      })
      await api.post('/api/revenue-entries/bulk', [payload])
      setMessage('✓ Saved successfully')
    } catch (err) {
      setMessage(
        '✗ ' + (err.response?.data?.detail || 'Failed to save')
      )
    } finally {
      setSaving(false)
      setTimeout(() => setMessage(''), 4000)
    }
  }

  const roomRev = Number(form.room_revenue) || 0
  const fnbRev = Number(form.fnb_revenue) || 0
  const other = Number(form.other_income) || 0
  const disc = Number(form.discount) || 0
  const gross = roomRev + fnbRev + other
  const net = gross - disc

  const roomsOccupied = Number(form.rooms_occupied) || 0
  const occupancy =
    autoRoomsAvailable > 0
      ? ((roomsOccupied / autoRoomsAvailable) * 100).toFixed(2) + '%'
      : '—'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Revenue Entry</h1>
        <p className="text-slate-500 text-sm">
          Enter monthly revenue figures
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
        <div className="text-center py-10 text-slate-500">
          Loading revenue…
        </div>
      ) : (
        <>
          <div className="card space-y-3">
            {FIELDS.map((f) => (
              <div key={f.key} className="flex items-center gap-3 py-1">
                <label className="flex-1 text-sm">{f.label}</label>
                <input
                  type="number"
                  className="input w-40 text-right"
                  value={form[f.key] ?? ''}
                  onChange={(e) => handleChange(f.key, e.target.value)}
                  placeholder="0"
                />
              </div>
            ))}

            {/* Read-only auto-computed rooms available */}
            <div className="flex items-center gap-3 py-1 bg-slate-50 rounded px-2">
              <label className="flex-1 text-sm">
                No. of Rooms Available{' '}
                <span className="text-slate-400 text-xs">
                  ({currentBranch?.rooms || 0} rooms × {days} days = auto)
                </span>
              </label>
              <div className="input w-40 text-right bg-slate-100 text-slate-600">
                {autoRoomsAvailable.toLocaleString('en-IN')}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="card-tight">
              <div className="text-xs text-slate-500">Gross Revenue</div>
              <div className="text-lg font-semibold">
                ₹{gross.toLocaleString('en-IN')}
              </div>
            </div>
            <div className="card-tight">
              <div className="text-xs text-slate-500">Net Revenue</div>
              <div className="text-lg font-semibold">
                ₹{net.toLocaleString('en-IN')}
              </div>
            </div>
            <div className="card-tight">
              <div className="text-xs text-slate-500">
                Occupancy (auto)
              </div>
              <div className="text-lg font-semibold">{occupancy}</div>
            </div>
          </div>

          <div className="card sticky bottom-4 flex items-center justify-end gap-3 shadow-lg">
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
              onClick={handleSave}
              disabled={saving}
              className="btn btn-primary disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
