import { useEffect, useState } from 'react'
import api from '../api'

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
]

export default function MonthlyReport() {
  const [branches, setBranches] = useState([])
  const [branchId, setBranchId] = useState('')
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [year, setYear] = useState(new Date().getFullYear())
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
      .get('/api/reports/monthly', {
        params: { branch_id: branchId, month, year },
      })
      .then((res) => setData(res.data))
      .catch((err) =>
        setError(err.response?.data?.detail || 'Failed to load report')
      )
      .finally(() => setLoading(false))
  }, [branchId, month, year])

  const money = (v) =>
    '₹' + (Number(v) || 0).toLocaleString('en-IN', {
      maximumFractionDigits: 0,
    })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Monthly Report</h1>
        <p className="text-slate-500 text-sm">
          Profit &amp; Loss for a single month
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

      {loading && (
        <div className="text-center py-10 text-slate-500">Loading…</div>
      )}

      {error && (
        <div className="card border-rose-200 bg-rose-50 text-rose-700">
          {error}
        </div>
      )}

      {!loading && !error && data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="card">
              <div className="text-xs text-slate-500">Gross Revenue</div>
              <div className="text-xl font-semibold text-blue-600">
                {money(data.gross_revenue)}
              </div>
            </div>
            <div className="card">
              <div className="text-xs text-slate-500">Total Expenses</div>
              <div className="text-xl font-semibold text-amber-600">
                {money(data.total_expenses)}
              </div>
            </div>
            <div className="card">
              <div className="text-xs text-slate-500">Net Profit</div>
              <div
                className={`text-xl font-semibold ${
                  data.net_profit >= 0
                    ? 'text-emerald-600'
                    : 'text-rose-600'
                }`}
              >
                {money(data.net_profit)}
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="font-semibold mb-3">Revenue</h3>
            <table className="table-clean">
              <tbody>
                <tr>
                  <td>Room Revenue</td>
                  <td className="text-right">
                    {money(data.revenue.room_revenue)}
                  </td>
                </tr>
                <tr>
                  <td>Restaurant / F&amp;B Revenue</td>
                  <td className="text-right">
                    {money(data.revenue.fnb_revenue)}
                  </td>
                </tr>
                <tr>
                  <td>Other Income</td>
                  <td className="text-right">
                    {money(data.revenue.other_income)}
                  </td>
                </tr>
                <tr className="font-semibold">
                  <td>Gross Revenue</td>
                  <td className="text-right">
                    {money(data.gross_revenue)}
                  </td>
                </tr>
                <tr>
                  <td>Less: Discount Allowed</td>
                  <td className="text-right text-rose-600">
                    − {money(data.revenue.discount)}
                  </td>
                </tr>
                <tr className="font-semibold">
                  <td>Net Revenue</td>
                  <td className="text-right">
                    {money(data.net_revenue)}
                  </td>
                </tr>
                <tr>
                  <td>GST Collected</td>
                  <td className="text-right">
                    {money(data.revenue.gst)}
                  </td>
                </tr>
                <tr className="font-semibold">
                  <td>Total Billing Value</td>
                  <td className="text-right">
                    {money(data.total_billing)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="card">
            <h3 className="font-semibold mb-3">Expenses</h3>
            <table className="table-clean">
              <tbody>
                {Object.entries(data.expenses).map(([head, amt]) => (
                  <tr key={head}>
                    <td>{head}</td>
                    <td className="text-right">{money(amt)}</td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td>Total Expenses</td>
                  <td className="text-right">
                    {money(data.total_expenses)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="card">
            <h3 className="font-semibold mb-3">Key Metrics</h3>
            <table className="table-clean">
              <tbody>
                <tr>
                  <td>Occupancy</td>
                  <td className="text-right">
                    {(data.occupancy_pct || 0).toFixed(1)}%
                  </td>
                </tr>
                <tr>
                  <td>Average Room Rent</td>
                  <td className="text-right">
                    ₹{(data.arr || 0).toFixed(0)}
                  </td>
                </tr>
                <tr>
                  <td>Rooms Available</td>
                  <td className="text-right">
                    {data.revenue.rooms_available}
                  </td>
                </tr>
                <tr>
                  <td>Rooms Occupied</td>
                  <td className="text-right">
                    {data.revenue.rooms_occupied}
                  </td>
                </tr>
                <tr>
                  <td>FnB Pax</td>
                  <td className="text-right">{data.revenue.pax_fnb}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
