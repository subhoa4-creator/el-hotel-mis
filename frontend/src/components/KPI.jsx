export default function KPI({ title, value, subtitle, accent = 'blue', icon }) {
  const colors = {
    blue: 'text-blue-600',
    green: 'text-emerald-600',
    red: 'text-rose-600',
    amber: 'text-amber-600',
    slate: 'text-slate-700',
  }

  const formatValue = (v) => {
    if (v === null || v === undefined) return '—'
    if (typeof v === 'number') {
      if (Math.abs(v) >= 100000) {
        return v.toLocaleString('en-IN', { maximumFractionDigits: 0 })
      }
      return v.toLocaleString('en-IN', { maximumFractionDigits: 2 })
    }
    return v
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-500">{title}</div>
        {icon && <span className="text-lg">{icon}</span>}
      </div>
      <div className={`text-2xl font-bold mt-1 ${colors[accent]}`}>
        {formatValue(value)}
      </div>
      {subtitle && (
        <div className="text-xs text-slate-400 mt-1">{subtitle}</div>
      )}
    </div>
  )
}
