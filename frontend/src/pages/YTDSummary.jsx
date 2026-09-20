import { useEffect, useState } from 'react'
import api from '../api'

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

const num = (v) => {
  if (v === null || v === undefined) return '—'
  const n = Number(v)
  if (isNaN(n)) return '—'
  return n.toFixed(2)
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

  if (loading) {
    return (
      <div className="text-center py-10 text-slate-500">Loading…</div>
    )
  }
  if (error) {
    return (
      <div className="card border-rose-200 bg-rose-50 text-rose-700">
        {error}
      </div>
    )
  }
  if (!data) return null

  const branches = data.branches || []
  const totals = data.totals || {}

  const cols = [...branches, { ...totals, branch: 'TOTAL', branch_id: 'total' }]

  const renderRow = (label, getter, formatter = money, opts = {}) => (
    <tr key={label} className={opts.header ? 'bg-slate-100 font-semibold' : ''}>
      <td className={opts.indent ? 'pl-6' : ''}>{label}</td>
      {cols.map((c) => (
        <td key={c.branch_id} className="text-right whitespace-nowrap">
          {formatter(getter(c))}
        </td>
      ))}
    </tr>
  )

  const section = (title) => (
    <tr key={title} className="bg-slate-800 text-white">
      <td colSpan={cols.length + 1} className="font-semibold">
        {title}
      </td>
    </tr>
  )

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

      <div className="card overflow-x-auto">
        <table className="table-clean min-w-[800px]">
          <thead>
            <tr>
              <th>Particulars</th>
              {cols.map((c) => (
                <th key={c.branch_id} className="text-right whitespace-nowrap">
                  {c.branch}
                </th>
              ))}
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
