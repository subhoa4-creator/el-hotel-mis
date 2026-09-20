import { useState } from 'react'
import { API_BASE } from '../api'

/**
 * Props:
 *   endpoints: {
 *     excel: '/api/export/excel/monthly',
 *     pdf:   '/api/export/pdf/monthly',
 *   }
 *   params: { month: 9, year: 2026, ... }  // querystring params
 *   filename: 'ElHotelMIS_Monthly_2026-09' (without extension)
 */
export default function ExportButtons({ endpoints, params, filename }) {
  const [busy, setBusy] = useState('')

  const buildUrl = (base) => {
    const url = new URL(base, API_BASE)
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, v)
    })
    return url.toString()
  }

  const download = async (type) => {
    setBusy(type)
    try {
      const url = buildUrl(
        type === 'excel' ? endpoints.excel : endpoints.pdf
      )
      const token = localStorage.getItem('token')

      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) {
        throw new Error(`Download failed (${res.status})`)
      }
      const blob = await res.blob()
      const ext = type === 'excel' ? 'xlsx' : 'pdf'
      const a = document.createElement('a')
      const objectUrl = URL.createObjectURL(blob)
      a.href = objectUrl
      a.download = `${filename}.${ext}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(objectUrl)
    } catch (err) {
      alert('Download failed: ' + err.message)
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={() => download('excel')}
        disabled={busy === 'excel'}
        className="btn bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 text-sm"
      >
        {busy === 'excel' ? 'Downloading…' : '📥 Excel'}
      </button>
      <button
        onClick={() => download('pdf')}
        disabled={busy === 'pdf'}
        className="btn bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-60 text-sm"
      >
        {busy === 'pdf' ? 'Downloading…' : '📄 PDF'}
      </button>
    </div>
  )
}
