'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'

export default function PressureCertsPage() {
  const [certs, setCerts]   = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const supabase = createClient()

  useEffect(() => {
    supabase.from('pressure_certificates')
      .select('*, customer:customers(name), engineer:profiles(full_name)')
      .order('created_at', { ascending: false })
      .then(({ data }) => { setCerts(data||[]); setLoading(false) })
  }, [])

  const filtered = certs.filter(c => {
    const q = search.toLowerCase()
    return !q ||
      c.cert_number?.toLowerCase().includes(q) ||
      c.customer?.name?.toLowerCase().includes(q) ||
      c.serial_number?.toLowerCase().includes(q) ||
      c.model?.toLowerCase().includes(q)
  })

  return (
    <div className="p-6 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Pressure calibration certificates</h1>
          <p className="text-gray-500 text-sm mt-1">{certs.length} certificates total</p>
        </div>
        <Link href="/dashboard/pressure/new" className="btn-primary">+ New certificate</Link>
      </div>

      <div className="mb-4">
        <input className="input max-w-md" placeholder="Search by cert no., customer, serial, model..."
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
                  <th className="px-5 py-3">Cert no.</th>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Model</th>
                  <th className="px-5 py-3">Serial no.</th>
                  <th className="px-5 py-3">Range</th>
                  <th className="px-5 py-3">Result</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(c=>(
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-mono text-xs text-gray-700 font-semibold">{c.cert_number}</td>
                    <td className="px-5 py-3 text-gray-700 whitespace-nowrap">
                      {c.calibration_date ? format(parseISO(c.calibration_date),'dd MMM yyyy') : '—'}
                    </td>
                    <td className="px-5 py-3 text-gray-700">{c.customer?.name??'—'}</td>
                    <td className="px-5 py-3 text-gray-700">{c.model??'—'}</td>
                    <td className="px-5 py-3 font-mono text-xs text-gray-500">{c.serial_number??'—'}</td>
                    <td className="px-5 py-3 text-xs text-gray-500">
                      {c.pressure_range ? `${c.vacuum_range ? c.vacuum_range + ' to ' : '0 to '}${c.pressure_range} ${c.pressure_unit}` : '—'}
                    </td>
                    <td className="px-5 py-3">
                      {c.overall_result==='pass'?<span className="badge-pass">Pass</span>
                       :c.overall_result==='fail'?<span className="badge-fail">Fail</span>
                       :<span className="badge-gray">—</span>}
                    </td>
                    <td className="px-5 py-3">
                      {c.status==='sent'?<span className="badge-pass">Sent</span>
                       :c.status==='complete'?<span className="badge-info">Complete</span>
                       :<span className="badge-warn">Draft</span>}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link href={`/dashboard/pressure/${c.id}`} className="text-brand-500 text-xs hover:underline">Open</Link>
                    </td>
                  </tr>
                ))}
                {filtered.length===0&&(
                  <tr><td colSpan={9} className="px-5 py-8 text-center text-gray-400 text-sm">No certificates yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
