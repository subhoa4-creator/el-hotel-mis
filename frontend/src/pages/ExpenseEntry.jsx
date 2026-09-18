import { useEffect, useMemo, useState } from 'react'
import api from '../api'

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
]

export default function ExpenseEntry() {
  const [branches, setBranches] = useState([])
  const [ledgers, setLedgers] = useState([])
  const [branchId, setBranchId] = useState('')
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [year, setYear] = useState(new Date().getFullYear())
  const [amounts, setAmounts] = useState({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    Promise.all([
      api.get('/api/branches/'),
      api.get('/api/expense-ledgers/'),
    ]).then(([b, l]) => {
      setBranches(b.data)
      setLedgers(l.data)
      if (b.data.length && !branchId) setBranchId(b.data[0].id)
    })
  }, [])

  useEffect(() => {
    if (!branchId) return
    setLoading(true)
    setMessage('')
    api
      .get('/api/expense-entries/', {
        params: { branch_id: branchId, month, year },
      })
      .then((res) => {
        const map = {}
        res.data.forEach((e) => {
          map[e.ledger_id] = e.amount
        })
        setAmounts(map)
      })
      .finally(() => setLoading(false))
  }, [branchId, month, year])

  const grouped = useMemo(() => {
    const groups = {}
    ledgers.forEach((l) => {
      const head = l.expense_head?.name || 'Unassigned'
      if (!groups[head]) groups[head] = []
      groups[head].push(l)
    })
    return groups
  }, [ledgers])

  const total = useMemo(() => {
    return Object.values(amounts).reduce(
      (sum, v) => sum + (Number(v) || 0),
      0
    )
  }, [amounts])

  const handleChange = (ledgerId, value) => {
    setAmounts((prev) => ({
      ...prev,
      [ledgerId]: value === '' ? '' : Number(value),
    }))
  }

  const handleSave = async () => {
    if (!branchId) return
    setSaving(true)
    setMessage('')
    try {
      const entries = ledgers
        .map((l) => ({
          branch_id: Number(branchId),
          ledger_id: l.id,
          month: Number(month),
          year: Number(year),
          amount: Number(amounts[l.id]) || 0,
        }))
      await api.post('/api/expense-entries/bulk', entries)
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Expense Entry</h1>
        <p className="text-slate-500 text-sm">
          Enter monthly expenses per ledger
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
          Loading ledgers…
        </div>
      ) : (
        <>
          {Object.entries(grouped).map(([head, items]) => (
            <div className="card" key={head}>
              <h3 className="font-semibold text-slate-700 mb-4">{head}</h3>
              <div className="space-y-2">
                {items.map((l) => (
                  <div
                    key={l.id}
                    className="flex items-center gap-3 py-1"
                  >
                    <div className="flex-1 text-sm">
                      {l.name}{' '}
                      <span
                        className={`badge ${
                          l.nature === 'Fixed'
                            ? 'badge-blue'
                            : 'badge-green'
                        }`}
                      >
                        {l.nature}
                      </span>
                    </div>
                    <input
                      type="number"
                      className="input w-32 text-right"
                      value={amounts[l.id] ?? ''}
                      onChange={(e) =>
                        handleChange(l.id, e.target.value)
                      }
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="card sticky bottom-4 flex items-center justify-between shadow-lg">
            <div>
              <div className="text-xs text-slate-500">Total for month</div>
              <div className="text-xl font-bold text-slate-800">
                ₹{total.toLocaleString('en-IN')}
              </div>
            </div>
            <div className="flex items-center gap-3">
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
          </div>
        </>
      )}
    </div>
  )
}
