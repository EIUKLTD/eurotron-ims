'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import { format, differenceInDays, parseISO } from 'date-fns'

function calBadge(date:string|null) {
  if (!date) return <span className="badge-gray">No date</span>
  const d = differenceInDays(parseISO(date), new Date())
  if (d < 0)   return <span className="badge-fail">Overdue</span>
  if (d <= 30) return <span className="badge-warn">Due in {d}d</span>
  if (d <= 90) return <span className="badge-info">Due in {d}d</span>
  return <span className="badge-pass">Current</span>
}

function statusBadge(s:string) {
  const map:Record<string,string> = { active:'badge-pass', inactive:'badge-gray', scrapped:'badge-fail', on_loan:'badge-warn' }
  return <span className={map[s]||'badge-gray'}>{s.replace('_',' ')}</span>
}

export default function InstrumentsPage() {
  const [instruments, setInstruments] = useState<any[]>([])
  const [filtered, setFiltered]       = useState<any[]>([])
  const [search, setSearch]           = useState('')
  const [loading, setLoading]         = useState(true)
  const supabase = createClient()

  useEffect(() => {
    supabase.from('instruments')
      .select('*, customer:customers(id,name), site:sites(id,name)')
      .order('name')
      .then(({ data }) => {
        setInstruments(data||[])
        setFiltered(data||[])
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(instruments.filter(i =>
      !q ||
      i.name.toLowerCase().includes(q) ||
      i.serial_number?.toLowerCase().includes(q) ||
      i.asset_tag?.toLowerCase().includes(q) ||
      i.customer?.name?.toLowerCase().includes(q) ||
      i.site?.name?.toLowerCase().includes(q) ||
      i.model?.toLowerCase().includes(q)
    ))
  }, [search, instruments])

  return (
    <div className="p-6 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Instruments</h1>
          <p className="text-gray-500 text-sm mt-1">{filtered.length} gas analysers</p>
        </div>
        <Link href="/dashboard/instruments/new" className="btn-primary">+ Add instrument</Link>
      </div>

      <div className="mb-4">
        <input className="input max-w-md" placeholder="Search by name, serial, asset tag, customer, site..."
          value={search} onChange={e=>setSearch(e.target.value)} />
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading...</div>
        ) : filtered.length===0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            {search?'No instruments match your search.':'No instruments yet. Add your first one!'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase bg-gray-50 text-left">
                  <th className="px-5 py-3">Instrument</th>
                  <th className="px-5 py-3">Customer / Site</th>
                  <th className="px-5 py-3">Serial / Asset</th>
                  <th className="px-5 py-3">Gases</th>
                  <th className="px-5 py-3">Cal due</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(inst=>(
                  <tr key={inst.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="font-medium text-gray-900">{inst.name}</div>
                      <div className="text-xs text-gray-400">{inst.make} {inst.model}</div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="text-gray-700 font-medium">{inst.customer?.name??'—'}</div>
                      {inst.site?.name && (
                        <div className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                          <span>📍</span>{inst.site.name}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="text-gray-700">{inst.serial_number??'—'}</div>
                      {inst.asset_tag&&<div className="text-xs text-gray-400">{inst.asset_tag}</div>}
                    </td>
                    <td className="px-5 py-3 text-gray-500 text-xs">{inst.gases_measured?.join(', ')??'—'}</td>
                    <td className="px-5 py-3">
                      <div>{calBadge(inst.next_cal_date)}</div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {inst.next_cal_date?format(parseISO(inst.next_cal_date),'dd MMM yyyy'):''}
                      </div>
                    </td>
                    <td className="px-5 py-3">{statusBadge(inst.status)}</td>
                    <td className="px-5 py-3 text-right space-x-3 whitespace-nowrap">
                      <Link href={`/dashboard/instruments/${inst.id}`} className="text-brand-500 text-xs hover:underline">View</Link>
                      <Link href={`/dashboard/instruments/${inst.id}/edit`} className="text-gray-500 text-xs hover:underline">Edit</Link>
                      <Link href={`/dashboard/reports/new?instrument=${inst.id}`} className="text-teal-600 text-xs hover:underline">New report</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}