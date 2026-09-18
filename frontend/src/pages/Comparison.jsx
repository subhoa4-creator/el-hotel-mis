import { useEffect, useState } from 'react'
import api from '../api'

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
]

export default function Comparison() {
  const [branches, setBranches] = useState([])
  const [branchId, setBranchId] = useState('')
  const [monthA, setMonthA] = useState(7)
  const [yearA, setYearA] = useState(new Date().getFullYear())
  const [monthB, setMonthB] = useState(8)
  const [yearB, setYearB] = useState(new Date().getFullYear())
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/api/branches/').then((res) => {
      setBranches(res.data)
      if (res.data.length) setBranchId(res.data[0].id)
    })
  }, [])

  useEffect(() => {
    if (!branchId) return
    setLoading(true)
    setError('')
    api
      .get('/api/reports/comparison', {
        params: {
          branch_id: branchId,
          month_a: monthA, year_a: yearA,
          month_b: monthB, year_b: yearB,
        },
      })
      .then((res) => setData(res.data))
      .catch((err) =>
        setError(err.response?.data?.detail || 'Failed to load comparison')
      )
      .finally(() => setLoading(false))
  }, [branchId, monthA, yearA, monthB, yearB])

  const money = (v) =>
    '₹' + (Number(v) || 0).toLocaleString('en-IN', {
      maximumFractionDigits: 0,
    })

  const pct = (v) => {
    if (!isFinite(v)) return '—'
    const sign = v > 0 ? '+' : ''
    return sign + v.toFixed(1) + '%'
  }

  const pctColor = (v) => {
    if (!isFinite(v) || v === 0) return 'text-slate-500'
    return v > 0 ? 'text-emerald-600' : 'text-rose-600'
  }

  const rows = data
    ? [
        { label: 'Gross Revenue',    a: data.period_a.gross_revenue,  b: data.period_b.gross_revenue,  v: data.variance.gross_revenue },
        { label: 'Total Expenses',   a: data.period_a.total_expenses, b: data.period_b.total_expenses, v: data.variance.total_expenses },
        { label: 'Net Profit',       a: data.period_a.net_profit,     b: data.period_b.net_profit,     v: data.variance.net_profit },
      ]
    : []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Comparison</h1>
        <p className="text-slate-500 text-sm">
          Compare two months side by side
        </p>
      </div>

      <div className="card">
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="font-semibold mb-3">Period A</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Month</label>
              <select
                className="input"
                value={monthA}
                onChange={(e) => setMonthA(Number(e.target.value))}
              >
                {MONTHS.map((m, i) => (
                  <option key={i} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Year</label>
              <input
                type="number"
                className="input"
                value={yearA}
                onChange={(e) => setYearA(Number(e.target.value))}
              />
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="font-semibold mb-3">Period B</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Month</label>
              <select
                className="input"
                value={monthB}
                onChange={(e) => setMonthB(Number(e.target.value))}
              >
                {MONTHS.map((m, i) => (
                  <option key={i} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Year</label>
              <input
                type="number"
                className="input"
                value={yearB}
                onChange={(e) => setYearB(Number(e.target.value))}
              />
            </div>
          </div>
        </div>
      </div>

      {loading && (
        <div className="text-center py-10 text-slate-500">Loading…</div>
      )}

      {error && (
        <div className="card border-rose-200 bg-rose-50 text-rose-700">
          {error}
        </div>
      )}

      {!loading && !error && data && (
        <div className="card overflow-x-auto">
          <table className="table-clean min-w-[600px]">
            <thead>
              <tr>
                <th>Metric</th>
                <th className="text-right">
                  {MONTHS[monthA - 1]} {yearA}
                </th>
                <th className="text-right">
                  {MONTHS[monthB - 1]} {yearB}
                </th>
                <th className="text-right">Variance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label}>
                  <td className="font-medium">{r.label}</td>
                  <td className="text-right">{money(r.a)}</td>
                  <td className="text-right">{money(r.b)}</td>
                  <td className={`text-right font-medium ${pctColor(r.v)}`}>
                    {pct(r.v)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-6 grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-slate-500">Occupancy (A → B)</div>
              <div className="text-sm">
                {(data.period_a.occupancy_pct || 0).toFixed(1)}% →{' '}
                {(data.period_b.occupancy_pct || 0).toFixed(1)}%
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Avg Room Rent (A → B)</div>
              <div className="text-sm">
                ₹{(data.period_a.arr || 0).toFixed(0)} → ₹
                {(data.period_b.arr || 0).toFixed(0)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
