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

const TABS = [
  { key: 'per-fy', label: 'Per FY' },
  { key: 'cumulative', label: 'Cumulative' },
  { key: 'grand-total', label: 'Grand Total' },
]

export default function AllFY() {
  const [tab, setTab] = useState('per-fy')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const endpointMap = {
    'per-fy': '/api/reports/all-fy',
    'cumulative': '/api/reports/cumulative',
    'grand-total': '/api/reports/grand-total',
  }

  useEffect(() => {
    setLoading(true)
    setError('')
    api
      .get(endpointMap[tab])
      .then((res) => setData(res.data))
      .catch((err) =>
        setError(err.response?.data?.detail || 'Failed to load')
      )
      .finally(() => setLoading(false))
  }, [tab])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">All Financial Years</h1>
        <p className="text-slate-500 text-sm">
          Complete history across every FY since start
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition ${
              tab === t.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="text-center py-10 text-slate-500">Loading…</div>
      )}

      {error && (
        <div className="card border-rose-200 bg-rose-50 text-rose-700">
          {error}
        </div>
      )}

      {!loading && !error && data && tab !== 'grand-total' && (
        <FYTable fyList={data.fy_list || []} />
      )}

      {!loading && !error && data && tab === 'grand-total' && (
        <GrandTotalTable data={data} />
      )}
    </div>
  )
}


function FYTable({ fyList }) {
  if (!fyList || fyList.length === 0) {
    return (
      <div className="card text-center py-10 text-slate-500">
        No data yet. Enter revenue or expenses to see Financial Years.
      </div>
    )
  }

  const cols = fyList.map((fy) => ({
    label: fy.fy_label,
    isCurrent: fy.is_current,
    data: fy.totals || {},
  }))

  const row = (label, getter, fmt = money, opts = {}) => (
    <tr key={label} className={opts.header ? 'bg-slate-100 font-semibold' : ''}>
      <td>{label}</td>
      {cols.map((c) => (
        <td
          key={c.label}
          className={`text-right whitespace-nowrap ${
            c.isCurrent ? 'bg-blue-50' : ''
          }`}
        >
          {fmt(getter(c.data))}
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
    <div className="card overflow-x-auto">
      <table className="table-clean min-w-[700px]">
        <thead>
          <tr>
            <th>Particulars</th>
            {cols.map((c) => (
              <th
                key={c.label}
                className={`text-right whitespace-nowrap ${
                  c.isCurrent ? 'bg-blue-50' : ''
                }`}
              >
                FY {c.label}
                {c.isCurrent ? ' (YTD)' : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {section('1) Revenue')}
          {row('Room Revenue', (c) => c.room_revenue)}
          {row('Restaurant / F&B Revenue', (c) => c.fnb_revenue)}
          {row('Other Income', (c) => c.other_income)}
          {row('Gross Revenue', (c) => c.gross_revenue, money, { header: true })}
          {row('Less: Discount Allowed', (c) => c.discount)}
          {row('Net Revenue', (c) => c.net_revenue, money, { header: true })}
          {row('GST Collected from Customers', (c) => c.gst)}
          {row('Total Billing Value', (c) => c.total_billing, money, { header: true })}
          {row('Pure Room Sale', (c) => c.pure_room_sale)}
          {row('Pure F&B Sale', (c) => c.pure_fnb_sale)}

          {section('2) Expenses')}
          {EXPENSE_HEADS.map((h) =>
            row(h, (c) => (c.expenses || {})[h] || 0)
          )}
          {row('Total Expenses', (c) => c.total_expenses, money, { header: true })}
          {row('Net Profit/(Loss)', (c) => c.net_profit, money, { header: true })}

          {section('3) Fixed / Variable')}
          {row('Total Fixed Expenses Excluding Rent', (c) => c.fixed_excluding_rent)}
          {row('Rent Expense', (c) => (c.expenses || {})['Rent Expense'] || 0)}
          {row('Total Fixed Expenses', (c) => c.total_fixed_expenses, money, { header: true })}
          {row('Total Variable Expenses', (c) => c.total_variable_expenses, money, { header: true })}
          {row('Loss/Profit Excluding Rent', (c) => c.loss_excluding_rent, money, { header: true })}
          {row('Total Staff Food Costing', (c) => c.staff_food_costing)}
          {row('Total Guest Food Costing', (c) => c.guest_food_costing)}
          {row('Plan Sale', (c) => c.plan_sale)}

          {section('4) Revenue Metrics')}
          {row('No of Days Operational', (c) => c.days_operational, int)}
          {row('No Of Room Available', (c) => c.rooms_available, int)}
          {row('Room Occupancy %', (c) => c.occupancy_pct, pct)}
          {row('Avg Room Rent', (c) => c.arr, money)}
          {row('Room Inventory', (c) => c.room_inventory, int)}
          {row('No of Pax - FnB', (c) => c.pax_fnb, int)}
          {row('Room Occupied', (c) => c.rooms_occupied, int)}
          {row('F&B Per Room', (c) => c.fnb_per_room, money)}
          {row('Running Cost of Per Room', (c) => c.running_cost_per_room, money)}
          {row('F&B Inventory', (c) => c.fb_inventory, pct)}

          {section('5) Variance / BEP')}
          {row('Variance (F&B Sale - Variable Expenses)', (c) => c.variance_fnb)}
          {row('Variance (Room Sale - Fixed Expenses)', (c) => c.variance_room)}
          {row('Shortage/(Excess) In Room Nights For BEP', (c) => c.room_nights_shortage, int)}
          {row('Target Room Night to Achieve Break Even', (c) => c.target_room_nights, int)}
          {row('Target Room Night Percentage', (c) => c.target_room_nights_pct, pct)}
          {row('Contribution in F&B Sale against Increase Room Night', (c) => c.fnb_contribution)}
          {row('FB Revenue Percentage', (c) => c.fb_revenue_pct, pct)}

          {section('6) Expense Ratios')}
          {row('Fixed Expense to Total Expense', (c) => c.fixed_pct, pct)}
          {row('Variable Expense To Total Expense', (c) => c.variable_pct, pct)}
          {row('Employee Cost To Total Expense', (c) => c.employee_cost_pct, pct)}
          {row('F&B Cost % of Total Expenses', (c) => c.fnb_cost_pct, pct)}
          {row('Hotel / Restaurant Operating Expenses % of Total Expense', (c) => c.hotel_opex_pct, pct)}
          {row('Rent Expense To Total Expense %', (c) => c.rent_pct, pct)}

          {section('7) Expense / Revenue Ratios')}
          {row('Employee Expenses as a % of Total Revenue', (c) => c.employee_to_revenue, pct)}
          {row('Hotel / Restaurant Operating Expenses as a % of Total Revenue', (c) => c.hotel_opex_to_revenue, pct)}
          {row('Rent Expense as a % of Total Revenue', (c) => c.rent_to_revenue, pct)}
          {row('Food and Beverage Expense as a % of FnB Revenue', (c) => c.fnb_cost_to_fnb_revenue, pct)}
        </tbody>
      </table>
    </div>
  )
}


function GrandTotalTable({ data }) {
  const branches = data.branches || []
  const totals = data.totals || {}

  const cols = [
    ...branches,
    { ...totals, branch: 'GRAND TOTAL', branch_id: 'grand' },
  ]

  const row = (label, getter, fmt = money, opts = {}) => (
    <tr key={label} className={opts.header ? 'bg-slate-100 font-semibold' : ''}>
      <td>{label}</td>
      {cols.map((c) => (
        <td key={c.branch_id} className="text-right whitespace-nowrap">
          {fmt(getter(c))}
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
    <div className="card overflow-x-auto">
      <table className="table-clean min-w-[900px]">
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
          {row('Room Revenue', (c) => c.room_revenue)}
          {row('Restaurant / F&B Revenue', (c) => c.fnb_revenue)}
          {row('Other Income', (c) => c.other_income)}
          {row('Gross Revenue', (c) => c.gross_revenue, money, { header: true })}
          {row('Less: Discount Allowed', (c) => c.discount)}
          {row('Net Revenue', (c) => c.net_revenue, money, { header: true })}
          {row('GST Collected from Customers', (c) => c.gst)}
          {row('Total Billing Value', (c) => c.total_billing, money, { header: true })}
          {row('Pure Room Sale', (c) => c.pure_room_sale)}
          {row('Pure F&B Sale', (c) => c.pure_fnb_sale)}

          {section('2) Expenses')}
          {EXPENSE_HEADS.map((h) =>
            row(h, (c) => (c.expenses || {})[h] || 0)
          )}
          {row('Total Expenses', (c) => c.total_expenses, money, { header: true })}
          {row('Net Profit/(Loss)', (c) => c.net_profit, money, { header: true })}

          {section('3) Fixed / Variable')}
          {row('Total Fixed Expenses Excluding Rent', (c) => c.fixed_excluding_rent)}
          {row('Rent Expense', (c) => (c.expenses || {})['Rent Expense'] || 0)}
          {row('Total Fixed Expenses', (c) => c.total_fixed_expenses, money, { header: true })}
          {row('Total Variable Expenses', (c) => c.total_variable_expenses, money, { header: true })}
          {row('Loss/Profit Excluding Rent', (c) => c.loss_excluding_rent, money, { header: true })}
          {row('Total Staff Food Costing', (c) => c.staff_food_costing)}
          {row('Total Guest Food Costing', (c) => c.guest_food_costing)}
          {row('Plan Sale', (c) => c.plan_sale)}

          {section('4) Revenue Metrics')}
          {row('No of Days Operational', (c) => c.days_operational, int)}
          {row('No Of Room Available', (c) => c.rooms_available, int)}
          {row('Room Occupancy %', (c) => c.occupancy_pct, pct)}
          {row('Avg Room Rent', (c) => c.arr, money)}
          {row('Room Inventory', (c) => c.room_inventory, int)}
          {row('No of Pax - FnB', (c) => c.pax_fnb, int)}
          {row('Room Occupied', (c) => c.rooms_occupied, int)}
          {row('F&B Per Room', (c) => c.fnb_per_room, money)}
          {row('Running Cost of Per Room', (c) => c.running_cost_per_room, money)}
          {row('F&B Inventory', (c) => c.fb_inventory, pct)}

          {section('5) Variance / BEP')}
          {row('Variance (F&B Sale - Variable Expenses)', (c) => c.variance_fnb)}
          {row('Variance (Room Sale - Fixed Expenses)', (c) => c.variance_room)}
          {row('Shortage/(Excess) In Room Nights For BEP', (c) => c.room_nights_shortage, int)}
          {row('Target Room Night to Achieve Break Even', (c) => c.target_room_nights, int)}
          {row('Target Room Night Percentage', (c) => c.target_room_nights_pct, pct)}
          {row('Contribution in F&B Sale against Increase Room Night', (c) => c.fnb_contribution)}
          {row('FB Revenue Percentage', (c) => c.fb_revenue_pct, pct)}

          {section('6) Expense Ratios')}
          {row('Fixed Expense to Total Expense', (c) => c.fixed_pct, pct)}
          {row('Variable Expense To Total Expense', (c) => c.variable_pct, pct)}
          {row('Employee Cost To Total Expense', (c) => c.employee_cost_pct, pct)}
          {row('F&B Cost % of Total Expenses', (c) => c.fnb_cost_pct, pct)}
          {row('Hotel / Restaurant Operating Expenses % of Total Expense', (c) => c.hotel_opex_pct, pct)}
          {row('Rent Expense To Total Expense %', (c) => c.rent_pct, pct)}

          {section('7) Expense / Revenue Ratios')}
          {row('Employee Expenses as a % of Total Revenue', (c) => c.employee_to_revenue, pct)}
          {row('Hotel / Restaurant Operating Expenses as a % of Total Revenue', (c) => c.hotel_opex_to_revenue, pct)}
          {row('Rent Expense as a % of Total Revenue', (c) => c.rent_to_revenue, pct)}
          {row('Food and Beverage Expense as a % of FnB Revenue', (c) => c.fnb_cost_to_fnb_revenue, pct)}
        </tbody>
      </table>
    </div>
  )
          }
