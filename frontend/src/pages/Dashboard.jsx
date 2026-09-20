import { useEffect, useState } from 'react'
import api from '../api'
import KPI from '../components/KPI'

export default function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [year] = useState(new Date().getFullYear())
  const [data, setData] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    api
      .get(`/api/reports/ytd?year=${year}`)
      .then((res) => {
        if (!cancelled) setData(res.data)
      })
      .catch((err) => {
        if (!cancelled)
          setError(err.response?.data?.detail || 'Failed to load dashboard')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [year])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500">
        Loading dashboard…
      </div>
    )
  }

  if (error) {
    return (
      <div className="card border-rose-200 bg-rose-50 text-rose-700">
        <p className="font-medium">Error</p>
        <p className="text-sm mt-1">{error}</p>
      </div>
    )
  }

  const totals = data?.totals || {}
  const branches = data?.branches || []

  const sorted = [...branches].sort(
    (a, b) => (b.net_profit || 0) - (a.net_profit || 0)
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-slate-500 text-sm">
          Year To Date · {year} · All Branches
        </p>
      </div>

      {/* Main KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI
          title="Gross Revenue"
          value={totals.gross_revenue}
          accent="blue"
          icon="₹"
        />
        <KPI
          title="Total Expenses"
          value={totals.total_expenses}
          accent="amber"
          icon="−"
        />
        <KPI
          title="Net Profit"
          value={totals.net_profit}
          accent={totals.net_profit >= 0 ? 'green' : 'red'}
          icon="="
        />
        <KPI
          title="Branches"
          value={branches.length}
          accent="slate"
          icon="#"
        />
      </div>

      {/* Fixed / Variable KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <KPI
          title="Total Fixed Expenses (YTD)"
          value={totals.total_fixed_expenses}
          accent="slate"
          subtitle={
            totals.total_expenses
              ? `${(
                  (totals.total_fixed_expenses /
                    totals.total_expenses) *
                  100
                ).toFixed(1)}% of total expenses`
              : ''
          }
        />
        <KPI
          title="Total Variable Expenses (YTD)"
          value={totals.total_variable_expenses}
          accent="slate"
          subtitle={
            totals.total_expenses
              ? `${(
                  (totals.total_variable_expenses /
                    totals.total_expenses) *
                  100
                ).toFixed(1)}% of total expenses`
              : ''
          }
        />
      </div>

      {/* Branch performance */}
      <div className="card">
        <h2 className="font-semibold text-lg mb-4">Branch Performance</h2>
        {sorted.length === 0 ? (
          <p className="text-slate-500 text-sm">No branch data yet.</p>
        ) : (
          <div className="overflow-x-auto -mx-6 px-6">
            <table className="table-clean min-w-[800px]">
              <thead>
                <tr>
                  <th>Branch</th>
                  <th className="text-right">Gross Revenue</th>
                  <th className="text-right">Fixed</th>
                  <th className="text-right">Variable</th>
                  <th className="text-right">Total Expenses</th>
                  <th className="text-right">Net Profit</th>
                  <th className="text-right">Occupancy</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((b) => (
                  <tr key={b.branch_id}>
                    <td className="font-medium">{b.branch}</td>
                    <td className="text-right">
                      ₹{(b.gross_revenue || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="text-right text-slate-600">
                      ₹
                      {(b.total_fixed_expenses || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="text-right text-slate-600">
                      ₹
                      {(b.total_variable_expenses || 0).toLocaleString(
                        'en-IN'
                      )}
                    </td>
                    <td className="text-right">
                      ₹{(b.total_expenses || 0).toLocaleString('en-IN')}
                    </td>
                    <td
                      className={`text-right font-medium ${
                        (b.net_profit || 0) >= 0
                          ? 'text-emerald-600'
                          : 'text-rose-600'
                      }`}
                    >
                      ₹{(b.net_profit || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="text-right">
                      {(b.occupancy_pct || 0).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
