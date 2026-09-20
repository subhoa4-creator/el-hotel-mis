import { useEffect, useMemo, useState } from 'react'
import api from '../api'

const NATURES = ['Fixed', 'Variable']

export default function Ledgers() {
  const [ledgers, setLedgers] = useState([])
  const [heads, setHeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)
  const [message, setMessage] = useState('')
  const [filterHead, setFilterHead] = useState('')
  const [filterNature, setFilterNature] = useState('')
  const [search, setSearch] = useState('')

  const [showAdd, setShowAdd] = useState(false)
  const [newLedger, setNewLedger] = useState({
    name: '',
    expense_head_id: '',
    nature: 'Variable',
  })

  const load = async () => {
    setLoading(true)
    try {
      const [l, h] = await Promise.all([
        api.get('/api/expense-ledgers/'),
        api.get('/api/expense-heads/'),
      ])
      setLedgers(l.data)
      setHeads(h.data)
      if (h.data.length) {
        setNewLedger((prev) => ({
          ...prev,
          expense_head_id: prev.expense_head_id || h.data[0].id,
        }))
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    return ledgers.filter((l) => {
      if (filterHead && String(l.expense_head_id) !== String(filterHead))
        return false
      if (filterNature && l.nature !== filterNature) return false
      if (search && !l.name.toLowerCase().includes(search.toLowerCase()))
        return false
      return true
    })
  }, [ledgers, filterHead, filterNature, search])

  const grouped = useMemo(() => {
    const groups = {}
    filtered.forEach((l) => {
      const head = l.expense_head?.name || 'Unassigned'
      if (!groups[head]) groups[head] = []
      groups[head].push(l)
    })
    Object.keys(groups).forEach((k) => {
      groups[k].sort((a, b) => a.name.localeCompare(b.name))
    })
    return groups
  }, [filtered])

  const counts = useMemo(() => {
    const fixed = ledgers.filter((l) => l.nature === 'Fixed').length
    const variable = ledgers.filter((l) => l.nature === 'Variable').length
    return { fixed, variable, total: ledgers.length }
  }, [ledgers])

  const updateNature = async (ledger, newNature) => {
    if (ledger.nature === newNature) return
    setSavingId(ledger.id)
    setMessage('')
    try {
      await api.patch(`/api/expense-ledgers/${ledger.id}/nature`, {
        nature: newNature,
      })
      setLedgers((prev) =>
        prev.map((l) =>
          l.id === ledger.id ? { ...l, nature: newNature } : l
        )
      )
      setMessage('✓ Updated')
      setTimeout(() => setMessage(''), 2000)
    } catch (err) {
      setMessage('✗ ' + (err.response?.data?.detail || 'Failed'))
    } finally {
      setSavingId(null)
    }
  }

  const updateHead = async (ledger, newHeadId) => {
    setSavingId(ledger.id)
    setMessage('')
    try {
      await api.put(`/api/expense-ledgers/${ledger.id}`, {
        name: ledger.name,
        expense_head_id: Number(newHeadId),
        nature: ledger.nature,
      })
      const newHead = heads.find((h) => h.id === Number(newHeadId))
      setLedgers((prev) =>
        prev.map((l) =>
          l.id === ledger.id
            ? { ...l, expense_head_id: Number(newHeadId), expense_head: newHead }
            : l
        )
      )
      setMessage('✓ Head updated')
      setTimeout(() => setMessage(''), 2000)
    } catch (err) {
      setMessage('✗ ' + (err.response?.data?.detail || 'Failed'))
    } finally {
      setSavingId(null)
    }
  }

  const deleteLedger = async (ledger) => {
    if (!window.confirm(`Delete ledger "${ledger.name}"?`)) return
    setSavingId(ledger.id)
    try {
      await api.delete(`/api/expense-ledgers/${ledger.id}`)
      setLedgers((prev) => prev.filter((l) => l.id !== ledger.id))
      setMessage('✓ Deleted')
      setTimeout(() => setMessage(''), 2000)
    } catch (err) {
      setMessage('✗ ' + (err.response?.data?.detail || 'Failed'))
    } finally {
      setSavingId(null)
    }
  }

  const createLedger = async () => {
    if (!newLedger.name.trim() || !newLedger.expense_head_id) {
      setMessage('✗ Name and Head are required')
      return
    }
    try {
      const res = await api.post('/api/expense-ledgers/', {
        name: newLedger.name.trim(),
        expense_head_id: Number(newLedger.expense_head_id),
        nature: newLedger.nature,
      })
      const newHead = heads.find(
        (h) => h.id === Number(newLedger.expense_head_id)
      )
      setLedgers((prev) => [
        ...prev,
        { ...res.data, expense_head: newHead },
      ])
      setMessage('✓ Ledger added')
      setShowAdd(false)
      setNewLedger({
        name: '',
        expense_head_id: heads[0]?.id || '',
        nature: 'Variable',
      })
      setTimeout(() => setMessage(''), 2000)
    } catch (err) {
      setMessage('✗ ' + (err.response?.data?.detail || 'Failed'))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Ledgers</h1>
          <p className="text-slate-500 text-sm">
            Manage expense ledgers and their nature (Fixed / Variable)
          </p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="btn btn-primary"
        >
          {showAdd ? 'Cancel' : '+ Add Ledger'}
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card-tight">
          <div className="text-xs text-slate-500">Total Ledgers</div>
          <div className="text-xl font-bold">{counts.total}</div>
        </div>
        <div className="card-tight">
          <div className="text-xs text-slate-500">Fixed</div>
          <div className="text-xl font-bold text-blue-600">{counts.fixed}</div>
        </div>
        <div className="card-tight">
          <div className="text-xs text-slate-500">Variable</div>
          <div className="text-xl font-bold text-emerald-600">
            {counts.variable}
          </div>
        </div>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="card border-blue-200 bg-blue-50/40">
          <h3 className="font-semibold mb-3">Add New Ledger</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="label">Ledger Name</label>
              <input
                className="input"
                value={newLedger.name}
                onChange={(e) =>
                  setNewLedger({ ...newLedger, name: e.target.value })
                }
                placeholder="e.g., Electricity Expense"
              />
            </div>
            <div>
              <label className="label">Expense Head</label>
              <select
                className="input"
                value={newLedger.expense_head_id}
                onChange={(e) =>
                  setNewLedger({
                    ...newLedger,
                    expense_head_id: e.target.value,
                  })
                }
              >
                {heads.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Nature</label>
              <select
                className="input"
                value={newLedger.nature}
                onChange={(e) =>
                  setNewLedger({ ...newLedger, nature: e.target.value })
                }
              >
                {NATURES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button onClick={createLedger} className="btn btn-primary">
              Save Ledger
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="label">Search</label>
          <input
            className="input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ledger name..."
          />
        </div>
        <div>
          <label className="label">Expense Head</label>
          <select
            className="input"
            value={filterHead}
            onChange={(e) => setFilterHead(e.target.value)}
          >
            <option value="">All Heads</option>
            {heads.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Nature</label>
          <select
            className="input"
            value={filterNature}
            onChange={(e) => setFilterNature(e.target.value)}
          >
            <option value="">All</option>
            {NATURES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      {message && (
        <div
          className={`text-sm ${
            message.startsWith('✓') ? 'text-emerald-600' : 'text-rose-600'
          }`}
        >
          {message}
        </div>
      )}

      {loading ? (
        <div className="text-center py-10 text-slate-500">
          Loading ledgers…
        </div>
      ) : (
        Object.entries(grouped).map(([head, items]) => (
          <div className="card" key={head}>
            <h3 className="font-semibold text-slate-700 mb-3">
              {head}{' '}
              <span className="text-slate-400 text-sm font-normal">
                ({items.length})
              </span>
            </h3>
            <div className="space-y-1">
              {items.map((l) => (
                <div
                  key={l.id}
                  className={`flex flex-wrap items-center gap-2 py-2 border-b border-slate-100 last:border-0 ${
                    savingId === l.id ? 'opacity-50' : ''
                  }`}
                >
                  <div className="flex-1 min-w-[160px] text-sm">
                    {l.name}
                  </div>

                  {/* Nature dropdown (editable) */}
                  <select
                    className={`input w-32 text-sm ${
                      l.nature === 'Fixed'
                        ? 'text-blue-700'
                        : 'text-emerald-700'
                    }`}
                    value={l.nature}
                    onChange={(e) => updateNature(l, e.target.value)}
                  >
                    {NATURES.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>

                  {/* Head dropdown (editable) */}
                  <select
                    className="input w-56 text-sm"
                    value={l.expense_head_id || ''}
                    onChange={(e) => updateHead(l, e.target.value)}
                  >
                    {heads.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={() => deleteLedger(l)}
                    className="btn btn-ghost text-rose-600 text-sm px-2"
                    title="Delete ledger"
                  >
                    🗑
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {!loading && filtered.length === 0 && (
        <div className="card text-center text-slate-500 py-10">
          No ledgers match your filters.
        </div>
      )}
    </div>
  )
            }
