import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import ExpenseEntry from './pages/ExpenseEntry'
import RevenueEntry from './pages/RevenueEntry'
import MonthlyReport from './pages/MonthlyReport'
import Comparison from './pages/Comparison'
import YTDSummary from './pages/YTDSummary'
import AllFY from './pages/AllFY'
import Ledgers from './pages/Ledgers'
import Branches from './pages/Branches'
import FoodCost from './pages/FoodCost'
import PlanSale from './pages/PlanSale'
import CostPerRoom from './pages/CostPerRoom'
import RoomHistory from './pages/RoomHistory'
import Users from './pages/Users'

function Protected({ children }) {
  const token = localStorage.getItem('token')
  return token ? children : <Navigate to="/" />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/app" element={<Protected><Layout /></Protected>}>
        <Route index element={<Dashboard />} />
        <Route path="expenses" element={<ExpenseEntry />} />
        <Route path="revenue" element={<RevenueEntry />} />
        <Route path="food-cost" element={<FoodCost />} />
        <Route path="plan-sale" element={<PlanSale />} />
        <Route path="monthly" element={<MonthlyReport />} />
        <Route path="comparison" element={<Comparison />} />
        <Route path="ytd" element={<YTDSummary />} />
        <Route path="all-fy" element={<AllFY />} />
        <Route path="ledgers" element={<Ledgers />} />
        <Route path="branches" element={<Branches />} />
        <Route path="room-history" element={<RoomHistory />} />
        <Route path="cost-per-room" element={<CostPerRoom />} />
        <Route path="users" element={<Users />} />
      </Route>
    </Routes>
  )
}
