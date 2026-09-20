import { useEffect, useState } from 'react'
import api from '../api'

// FY month order: Apr → Mar
const FY_MONTHS = [
  { num: 4, label: 'April' },
  { num: 5, label: 'May' },
  { num: 6, label: 'June' },
  { num: 7, label: 'July' },
  { num: 8, label: 'August' },
  { num: 9, label: 'September' },
  { num: 10, label: 'October' },
  { num: 11, label: 'November' },
  { num: 12, label: 'December' },
  { num: 1, label: 'January' },
  { num: 2, label: 'February' },
  { num: 3, label: 'March' },
]

const money = (v) => {
  if (v === null || v === undefined) return '—'
  const n = Number(v)
  if (isNaN(n)) return '—'
  return n.toLocaleString('en-IN', { maximumFractionDigits: 0 })
}
const pct = (v) => {
  if (v === null || v === undefined) return '—'
  const n = Number(v)
  if (isNaN(n)) return '—'
  return (n * 100).toFixed(2) + '%'
}
const int = (v) => {
  if (v === null || v === undefined) return '—'
  const n = Number(v)
  if (isNaN(n)) return '—'
  return n.toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

const EXPENSE_HEADS = [
  'Employee Expenses',
  'Finance Expense',
  'Food and Beverage Expense',
  'Hotel / Restaurant Operating Expenses',
  'Marketing & Sales Expenses',
  'Miscellaneous Expenses',
  'Rent Expense',
  'Repair & Maintance Expenses',
  'Traveling & Conveyance Expneses',
]

export default function Comparison() {
  const now = new Date()
  const defaultFy =
    now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear() - 1

  // Period A (default: last month)
  const [fyA, setFyA] = useState(defaultFy)
  const [monthA, setMonthA] = useState(now.getMonth() === 0 ? 12 : now.getMonth())

  // Period B (default: current month)
  const [fyB, setFyB] = useState(defaultFy)
  const [monthB, setMonthB] = useState(now.getMonth() + 1)

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const yearA = monthA >= 4 ? fyA : fyA + 1
  const yearB = monthB >= 4 ? fyB : fyB + 1

  useEffect(() => {
    setLoading(true)
    setError('')
    api
      .get('/api/reports/comparison', {
        params: {
          month_a: monthA, year_a: yearA,
          month_b: monthB, year_b: yearB,
        },
      })
      .then((res) => setData(res.data))
      .catch((err) =>
        setError(err.response?.data?.detail || 'Failed to load comparison')
      )
      .finally(() => setLoading(false))
  }, [monthA, yearA, monthB, yearB])

  if (loading) {
    return <div className="text-center py-10 text-slate-500">Loading…</div>
  }
  if (error) {
    return (
      <div className="card border-rose-200 bg-rose-50 text-rose-700">
        {error}
      </div>
    )
  }
  if (!data) return null

  const A = data.period_a
  const B = data.period_b
  const branches = A.branches || []

  const renderRow = (label, getter, fmt = money, opts = {}) => (
    <tr key={label} className={opts.header ? 'bg-slate-100 font-semibold' : ''}>
      <td>{label}</td>
      {branches.map((b) => (
        <td key={'a-' + b.branch_id} className="text-right whitespace-nowrap">
          {fmt(getter(b))}
        </td>
      ))}
      <td className="text-right whitespace-nowrap bg-slate-50 font-medium">
        {fmt(getter({ ...A.totals }))}
      </td>
      {branches.map((b) => (
        <td key={'b-' + b.branch_id} className="text-right whitespace-nowrap">
          {fmt(getter(b))}
        </td>
      ))}
      <td className="text-right whitespace-nowrap bg-slate-50 font-medium">
        {fmt(getter({ ...B.totals }))}
      </td>
    </tr>
  )

  const section = (title) => (
    <tr key={title} className="bg-slate-800 text-white">
      <td colSpan={branches.length * 2 + 3} className="font-semibold">
        {title}
      </td>
    </tr>
  )

  const monthLabelA = FY_MONTHS.find((m) => m.num === monthA)?.label || ''
  const monthLabelB = FY_MONTHS.find((m) => m.num === monthB)?.label || ''

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Comparison</h1>
        <p className="text-slate-500 text-sm">
          Two months side by side — all branches
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="font-semibold mb-3">Period A</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Financial Year</label>
              <select
                className="input"
                value={fyA}
                onChange={(e) => setFyA(Number(e.target.value))}
              >
                {[fyA - 1, fyA, fyA + 1].map((y) => (
                  <option key={y} value={y}>
                    {y}-{(y + 1) % 100}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Month</label>
              <select
                className="input"
                value={monthA}
                onChange={(e) => setMonthA(Number(e.target.value))}
              >
                {FY_MONTHS.map((m) => (
                  <option key={m.num} value={m.num}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2 text-xs text-slate-500">
              Showing: {monthLabelA} {yearA}
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="font-semibold mb-3">Period B</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Financial Year</label>
              <select
                className="input"
                value={fyB}
                onChange={(e) => setFyB(Number(e.target.value))}
              >
                {[fyB - 1, fyB, fyB + 1].map((y) => (
                  <option key={y} value={y}>
                    {y}-{(y + 1) % 100}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Month</label>
              <select
                className="input"
                value={monthB}
                onChange={(e) => setMonthB(Number(e.target.value))}
              >
                {FY_MONTHS.map((m) => (
                  <option key={m.num} value={m.num}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2 text-xs text-slate-500">
              Showing: {monthLabelB} {yearB}
            </div>
          </div>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="table-clean" style={{ minWidth: '1400px' }}>
          <thead>
            <tr>
              <th rowSpan={2} className="align-bottom">Particulars</th>
              <th colSpan={branches.length + 1} className="text-center bg-blue-50">
                Period A — {monthLabelA} {yearA}
              </th>
              <th colSpan={branches.length + 1} className="text-center bg-emerald-50">
                Period B — {monthLabelB} {yearB}
              </th>
            </tr>
            <tr>
              {branches.map((b) => (
                <th key={'a-h-' + b.branch_id} className="text-right whitespace-nowrap">
                  {b.branch}
                </th>
              ))}
              <th className="text-right whitespace-nowrap">Total</th>
              {branches.map((b) => (
                <th key={'b-h-' + b.branch_id} className="text-right whitespace-nowrap">
                  {b.branch}
                </th>
              ))}
              <th className="text-right whitespace-nowrap">Total</th>
            </tr>
          </thead>
          <tbody>
            {section('1) Revenue')}
            {renderRow('Room Revenue', (c) => c.room_revenue)}
            {renderRow('Restaurant / F&B Revenue', (c) => c.fnb_revenue)}
            {renderRow('Other Income', (c) => c.other_income)}
            {renderRow('Gross Revenue', (c) => c.gross_revenue, money, { header: true })}
            {renderRow('Less: Discount Allowed', (c) => c.discount)}
            {renderRow('Net Revenue', (c) => c.net_revenue, money, { header: true })}
            {renderRow('GST Collected from Customers', (c) => c.gst)}
            {renderRow('Total Billing Value', (c) => c.total_billing, money, { header: true })}
            {renderRow('Pure Room Sale', (c) => c.pure_room_sale)}
            {renderRow('Pure F&B Sale', (c) => c.pure_fnb_sale)}

            {section('2) Expenses')}
            {EXPENSE_HEADS.map((h) =>
              renderRow(h, (c) => (c.expenses || {})[h] || 0)
            )}
            {renderRow('Total Expenses', (c) => c.total_expenses, money, { header: true })}
            {renderRow('Net Profit/(Loss)', (c) => c.net_profit, money, { header: true })}

            {section('3) Fixed / Variable')}
            {renderRow('Total Fixed Expenses Excluding Rent', (c) => c.fixed_excluding_rent)}
            {renderRow('Rent Expense', (c) => (c.expenses || {})['Rent Expense'] || 0)}
            {renderRow('Total Fixed Expenses', (c) => c.total_fixed_expenses, money, { header: true })}
            {renderRow('Total Variable Expenses', (c) => c.total_variable_expenses, money, { header: true })}
            {renderRow('Loss/Profit Excluding Rent', (c) => c.loss_excluding_rent, money, { header: true })}
            {renderRow('Total Staff Food Costing', (c) => c.staff_food_costing)}
            {renderRow('Total Guest Food Costing', (c) => c.guest_food_costing)}
            {renderRow('Plan Sale', (c) => c.plan_sale)}

            {section('4) Revenue Metrics')}
            {renderRow('No of Days Operational', (c) => c.days_operational, int)}
            {renderRow('No Of Room Available', (c) => c.rooms_available, int)}
            {renderRow('Room Occupancy %', (c) => c.occupancy_pct, pct)}
            {renderRow('Avg Room Rent', (c) => c.arr, money)}
            {renderRow('Room Inventory', (c) => c.room_inventory, int)}
            {renderRow('No of Pax - FnB', (c) => c.pax_fnb, int)}
            {renderRow('Room Occupied', (c) => c.rooms_occupied, int)}
            {renderRow('F&B Per Room', (c) => c.fnb_per_room, money)}
            {renderRow('Running Cost of Per Room', (c) => c.running_cost_per_room, money)}
            {renderRow('F&B Inventory', (c) => c.fb_inventory, pct)}

            {section('5) Variance / BEP')}
            {renderRow('Variance (F&B Sale - Variable Expenses)', (c) => c.variance_fnb)}
            {renderRow('Variance (Room Sale - Fixed Expenses)', (c) => c.variance_room)}
            {renderRow('Shortage/(Excess) In Room Nights For BEP', (c) => c.room_nights_shortage, int)}
            {renderRow('Target Room Night to Achieve Break Even', (c) => c.target_room_nights, int)}
            {renderRow('Target Room Night Percentage', (c) => c.target_room_nights_pct, pct)}
            {renderRow('Contribution in F&B Sale against Increase Room Night', (c) => c.fnb_contribution)}
            {renderRow('FB Revenue Percentage', (c) => c.fb_revenue_pct, pct)}

            {section('6) Expense Ratios')}
            {renderRow('Fixed Expense to Total Expense', (c) => c.fixed_pct, pct)}
            {renderRow('Variable Expense To Total Expense', (c) => c.variable_pct, pct)}
            {renderRow('Employee Cost To Total Expense', (c) => c.employee_cost_pct, pct)}
            {renderRow('F&B Cost % of Total Expenses', (c) => c.fnb_cost_pct, pct)}
            {renderRow('Hotel / Restaurant Operating Expenses % of Total Expense', (c) => c.hotel_opex_pct, pct)}
            {renderRow('Rent Expense To Total Expense %', (c) => c.rent_pct, pct)}

            {section('7) Expense / Revenue Ratios')}
            {renderRow('Employee Expenses as a % of Total Revenue', (c) => c.employee_to_revenue, pct)}
            {renderRow('Hotel / Restaurant Operating Expenses as a % of Total Revenue', (c) => c.hotel_opex_to_revenue, pct)}
            {renderRow('Rent Expense as a % of Total Revenue', (c) => c.rent_to_revenue, pct)}
            {renderRow('Food and Beverage Expense as a % of FnB Revenue', (c) => c.fnb_cost_to_fnb_revenue, pct)}
          </tbody>
        </table>
      </div>
    </div>
  )
}
