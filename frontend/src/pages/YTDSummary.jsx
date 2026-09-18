import { useEffect, useState } from 'react'
import api from '../api'

export default function YTDSummary() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')
    api
      .get('/api/reports/ytd', { params: { year } })
      .then((res) => setData(res.data))
      .catch((err) =>
        setError(err.response?.data?.detail || 'Failed to load YTD')
      )
      .finally(() => setLoading(false))
  }, [year])

  const money = (v) =>
    '₹' + (Number(v) || 0).toLocaleString('en-IN', {
      maximumFractionDigits: 0,
    })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">YTD Summary</h1>
          <p className="text-slate-500 text-sm">
            Year To Date across all branches
          </p>
        </div>
        <div>
          <label className="label">Year</label>
          <input
            type="number"
            className="input w-32"
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
              <div className="text-xs text-slate-500">Total Gross Revenue</div>
              <div className="text-xl font-semibold text-blue-600">
                {money(data.totals.gross_revenue)}
              </div>
            </div>
            <div className="card">
              <div className="text-xs text-slate-500">Total Expenses</div>
              <div className="text-xl font-semibold text-amber-600">
                {money(data.totals.total_expenses)}
              </div>
            </div>
            <div className="card">
              <div className="text-xs text-slate-500">Total Net Profit</div>
              <div
                className={`text-xl font-semibold ${
                  data.totals.net_profit >= 0
                    ? 'text-emerald-600'
                    : 'text-rose-600'
                }`}
              >
                {money(data.totals.net_profit)}
              </div>
            </div>
          </div>

          <div className="card overflow-x-auto">
            <table className="table-clean min-w-[700px]">
              <thead>
                <tr>
                  <th>Branch</th>
                  <th className="text-right">Gross Revenue</th>
                  <th className="text-right">Expenses</th>
                  <th className="text-right">Net Profit</th>
                  <th className="text-right">Occupancy</th>
                  <th className="text-right">ARR</th>
                </tr>
              </thead>
              <tbody>
                {data.branches.map((b) => (
                  <tr key={b.branch_id}>
                    <td className="font-medium">{b.branch}</td>
                    <td className="text-right">
                      {money(b.gross_revenue)}
                    </td>
                    <td className="text-right">
                      {money(b.total_expenses)}
                    </td>
                    <td
                      className={`text-right font-medium ${
                        (b.net_profit || 0) >= 0
                          ? 'text-emerald-600'
                          : 'text-rose-600'
                      }`}
                    >
                      {money(b.net_profit)}
                    </td>
                    <td className="text-right">
                      {(b.occupancy_pct || 0).toFixed(1)}%
                    </td>
                    <td className="text-right">
                      ₹{(b.arr || 0).toFixed(0)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-slate-100 font-semibold">
                  <td>Total</td>
                  <td className="text-right">
                    {money(data.totals.gross_revenue)}
                  </td>
                  <td className="text-right">
                    {money(data.totals.total_expenses)}
                  </td>
                  <td
                    className={`text-right ${
                      (data.totals.net_profit || 0) >= 0
                        ? 'text-emerald-600'
                        : 'text-rose-600'
                    }`}
                  >
                    {money(data.totals.net_profit)}
                  </td>
                  <td />
                  <td />
                </tr>
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.branches.map((b) => (
              <div key={b.branch_id} className="card">
                <h3 className="font-semibold mb-3">{b.branch}</h3>
                <table className="table-clean">
                  <tbody>
                    {Object.entries(b.expenses || {}).map(([head, amt]) => (
                      <tr key={head}>
                        <td className="text-sm">{head}</td>
                        <td className="text-right text-sm">{money(amt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
