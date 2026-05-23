'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'

export default function ReportsPage() {
  const [reports, setReports] = useState<any[]>([])
  const [search, setSearch]   = useState('')
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    supabase.from('service_reports')
      .select('*, instrument:instruments(name,serial_number), customer:customers(name), engineer:profiles(full_name)')
      .order('visit_date', { ascending: false })
      .then(({ data }) => { setReports(data||[]); setLoading(false) })
  }, [])

  const filtered = reports.filter(r => {
    const q = search.toLowerCase()
    return !q ||
      r.report_number?.toLowerCase().includes(q) ||
      r.customer?.name?.toLowerCase().includes(q) ||
      r.instrument?.name?.toLowerCase().includes(q) ||
      r.instrument?.serial_number?.toLowerCase().includes(q) ||
      r.sage_number?.toLowerCase().includes(q)
  })

  return (
    <div className="p-6 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Service reports</h1>
          <p className="text-gray-500 text-sm mt-1">{reports.length} reports total</p>
        </div>
        <Link href="/dashboard/reports/new" className="btn-primary">+ New report</Link>
      </div>

      <div className="mb-4">
        <input className="input max-w-md" placeholder="Search by report no., customer, instrument, Sage no..."
          value={search} onChange={e=>setSearch(e.target.value)} />
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase bg-gray-50 text-left">
                  <th className="px-5 py-3">Report no.</th>
                  <th className="px-5 py-3">Sage no.</th>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Instrument</th>
                  <th className="px-5 py-3">Engineer</th>
                  <th className="px-5 py-3">Result</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(r=>(
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-mono text-xs text-gray-700">{r.report_number}</td>
                    <td className="px-5 py-3">
                      {r.sage_number
                        ? <span className="font-mono text-xs text-brand-600">{r.sage_number}</span>
                        : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-5 py-3 text-gray-700 whitespace-nowrap">
                      {r.visit_date ? format(parseISO(r.visit_date),'dd MMM yyyy') : '—'}
                    </td>
                    <td className="px-5 py-3 text-gray-700">{r.customer?.name??'—'}</td>
                    <td className="px-5 py-3">
                      <div className="text-gray-800">{r.instrument?.name??'—'}</div>
                      <div className="text-xs text-gray-400">{r.instrument?.serial_number??''}</div>
                    </td>
                    <td className="px-5 py-3 text-gray-600">{r.engineer?.full_name??'—'}</td>
                    <td className="px-5 py-3">
                      {r.overall_result==='pass'?<span className="badge-pass">Pass</span>
                       :r.overall_result==='fail'?<span className="badge-fail">Fail</span>
                       :<span className="badge-gray">—</span>}
                    </td>
                    <td className="px-5 py-3">
                      {r.status==='sent'?<span className="badge-pass">Sent</span>
                       :r.status==='complete'?<span className="badge-info">Complete</span>
                       :<span className="badge-warn">Draft</span>}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link href={`/dashboard/reports/${r.id}`} className="text-brand-500 text-xs hover:underline">Open</Link>
                    </td>
                  </tr>
                ))}
                {filtered.length===0&&(
                  <tr><td colSpan={9} className="px-5 py-8 text-center text-gray-400 text-sm">No reports found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
