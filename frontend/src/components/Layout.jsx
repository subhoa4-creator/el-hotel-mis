import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'

const links = [
  { to: '/app', label: 'Dashboard', end: true },
  { to: '/app/expenses', label: 'Expense Entry' },
  { to: '/app/revenue', label: 'Revenue Entry' },
  { to: '/app/monthly', label: 'Monthly Report' },
  { to: '/app/comparison', label: 'Comparison' },
  { to: '/app/ytd', label: 'YTD Summary' },
]

export default function Layout() {
  const nav = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const user = JSON.parse(localStorage.getItem('user') || '{}')

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    nav('/')
  }

  const SidebarContent = () => (
    <>
      <div className="px-4 py-5 border-b border-slate-800">
        <h1 className="text-xl font-bold text-white">El Hotel MIS</h1>
        <p className="text-xs text-slate-400 mt-1">Multi-Branch Hospitality</p>
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.end}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `block px-3 py-2 rounded-lg text-sm font-medium transition ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            {l.label}
          </NavLink>
        ))}
      </nav>
      <div className="p-3 border-t border-slate-800">
        <div className="text-xs text-slate-400 mb-2 px-2">
          <div className="font-medium text-slate-200">{user.name || 'User'}</div>
          <div>{user.role || 'viewer'}</div>
        </div>
        <button
          onClick={logout}
          className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition"
        >
          Logout
        </button>
      </div>
    </>
  )

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 bg-slate-900 flex-col">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar (drawer) */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="relative w-64 bg-slate-900 flex flex-col z-50">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col">
        {/* Mobile top bar */}
        <header className="md:hidden bg-slate-900 text-white px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-2xl leading-none"
            aria-label="Open menu"
          >
            ☰
          </button>
          <span className="font-bold">El Hotel MIS</span>
          <span className="w-6" />
        </header>

        <main className="flex-1 p-4 md:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
