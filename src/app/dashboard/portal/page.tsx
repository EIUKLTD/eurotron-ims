'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Instrument, ServiceReport } from '@/types'
import Link from 'next/link'
import { format, differenceInDays, parseISO } from 'date-fns'

export default function PortalPage() {
  const [instruments, setInstruments] = useState<Instrument[]>([])
  const [reports, setReports]         = useState<ServiceReport[]>([])
  const [profile, setProfile]         = useState<any>(null)
  const [loading, setLoading]         = useState(true)
  const [tab, setTab]                 = useState<'instruments'|'reports'>('instruments')
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: prof } = await supabase.from('profiles').select('*, customer:customers(*)').eq('id', user.id).single()
      setProfile(prof)
      if (!prof?.company_id) { setLoading(false); return }
      const [{ data: insts }, { data: rpts }] = await Promise.all([
        supabase.from('instruments').select('*').eq('customer_id', prof.company_id).eq('status','active').order('name'),
        supabase.from('service_reports').select('*, instrument:instruments(name,serial_number)').eq('customer_id', prof.company_id).order('visit_date', { ascending:false }).limit(50)
      ])
      setInstruments((insts as any)||[])
      setReports((rpts as any)||[])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="p-8 text-gray-400 text-sm">Loading…</div>

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">
          {profile?.customer?.name ?? 'Customer portal'}
        </h1>
        <p className="text-gray-500 text-sm mt-1">Your gas analyser instruments and service records</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card p-4">
          <div className="text-3xl font-bold text-brand-700">{instruments.length}</div>
          <div className="text-sm text-gray-600 mt-1">Active instruments</div>
        </div>
        <div className="card p-4">
          <div className="text-3xl font-bold text-amber-600">
            {instruments.filter(i => i.next_cal_date && differenceInDays(parseISO(i.next_cal_date), new Date()) < 0).length}
          </div>
          <div className="text-sm text-gray-600 mt-1">Calibrations overdue</div>
        </div>
        <div className="card p-4">
          <div className="text-3xl font-bold text-teal-600">{reports.length}</div>
          <div className="text-sm text-gray-600 mt-1">Service reports</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-xl p-1 w-fit">
        {(['instruments','reports'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab===t?'bg-white shadow text-gray-900':'text-gray-500 hover:text-gray-700'}`}>
            {t === 'instruments' ? `Instruments (${instruments.length})` : `Reports (${reports.length})`}
          </button>
        ))}
      </div>

      {tab === 'instruments' && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase bg-gray-50 text-left">
                <th className="px-5 py-3">Instrument</th>
                <th className="px-5 py-3">Serial / Asset</th>
                <th className="px-5 py-3">Location</th>
                <th className="px-5 py-3">Cal due</th>
                <th className="px-5 py-3">Cal status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {instruments.map(inst => {
                const days = inst.next_cal_date ? differenceInDays(parseISO(inst.next_cal_date), new Date()) : null
                return (
                  <tr key={inst.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <div className="font-medium text-gray-900">{inst.name}</div>
                      <div className="text-xs text-gray-400">{inst.make} {inst.model}</div>
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      <div>{inst.serial_number??'—'}</div>
                      <div className="text-xs text-gray-400">{inst.asset_tag??''}</div>
                    </td>
                    <td className="px-5 py-3 text-gray-600">{inst.location??'—'}</td>
                    <td className="px-5 py-3 text-gray-700">
                      {inst.next_cal_date ? format(parseISO(inst.next_cal_date),'dd MMM yyyy') : '—'}
                    </td>
                    <td className="px-5 py-3">
                      {days===null?<span className="badge-gray">No date</span>
                       :days<0?<span className="badge-fail">Overdue by {Math.abs(days)}d</span>
                       :days<=30?<span className="badge-warn">Due in {days}d</span>
                       :days<=90?<span className="badge-info">Due in {days}d</span>
                       :<span className="badge-pass">Current</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'reports' && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase bg-gray-50 text-left">
                <th className="px-5 py-3">Report no.</th>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Instrument</th>
                <th className="px-5 py-3">Result</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {reports.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-mono text-xs text-gray-700">{r.report_number}</td>
                  <td className="px-5 py-3 text-gray-700">{format(parseISO(r.visit_date),'dd MMM yyyy')}</td>
                  <td className="px-5 py-3 text-gray-700">{(r as any).instrument?.name??'—'}</td>
                  <td className="px-5 py-3">
                    {r.overall_result==='pass'?<span className="badge-pass">Pass</span>
                     :r.overall_result==='fail'?<span className="badge-fail">Fail</span>
                     :<span className="badge-gray">—</span>}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {r.pdf_url
                      ? <a href={r.pdf_url} target="_blank" className="text-brand-500 text-xs hover:underline">Download PDF</a>
                      : <Link href={`/reports/${r.id}`} className="text-brand-500 text-xs hover:underline">View</Link>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
