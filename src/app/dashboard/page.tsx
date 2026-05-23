'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import { format, differenceInDays, parseISO } from 'date-fns'

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null)
  const [alerts, setAlerts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const today = new Date().toISOString().split('T')[0]
      const in90  = new Date(Date.now()+90*86400000).toISOString().split('T')[0]
      const in30  = new Date(Date.now()+30*86400000).toISOString().split('T')[0]
      const month1 = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]

      const [
        { count: total },
        { count: active },
        { count: customers },
        { count: rpts },
        { count: overdue },
        { count: soon },
        { data: alertInstruments }
      ] = await Promise.all([
        supabase.from('instruments').select('*', { count:'exact', head:true }),
        supabase.from('instruments').select('*', { count:'exact', head:true }).eq('status','active'),
        supabase.from('customers').select('*', { count:'exact', head:true }),
        supabase.from('service_reports').select('*', { count:'exact', head:true }).gte('visit_date', month1),
        supabase.from('instruments').select('*', { count:'exact', head:true }).lt('next_cal_date', today),
        supabase.from('instruments').select('*', { count:'exact', head:true }).gte('next_cal_date', today).lte('next_cal_date', in30),
        supabase.from('instruments').select('*, customer:customers(name)').lte('next_cal_date', in90).eq('status','active').order('next_cal_date').limit(10)
      ])

      setStats({ total:total||0, active:active||0, customers:customers||0, rpts:rpts||0, overdue:overdue||0, soon:soon||0 })
      setAlerts(alertInstruments||[])
      setLoading(false)
    }
    load()
  }, [])

  function calStatus(date:string|null) {
    if (!date) return 'unknown'
    const d = differenceInDays(parseISO(date), new Date())
    if (d < 0) return 'overdue'
    if (d <= 30) return 'due_soon'
    return 'ok'
  }

  return (
    <div className="p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Eurotron Instruments (UK) Ltd - Gas Analyser Management</p>
      </div>

      {loading ? (
        <div className="text-gray-400 text-sm">Loading...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
            <Link href="/dashboard/instruments" className="card p-4 hover:shadow-md transition-shadow bg-blue-50 text-blue-700">
              <div className="text-3xl font-bold">{stats.active}</div>
              <div className="text-sm font-medium mt-1">Active instruments</div>
              <div className="text-xs opacity-70 mt-0.5">of {stats.total} total</div>
            </Link>
            <Link href="/dashboard/customers" className="card p-4 hover:shadow-md transition-shadow bg-purple-50 text-purple-700">
              <div className="text-3xl font-bold">{stats.customers}</div>
              <div className="text-sm font-medium mt-1">Customers</div>
              <div className="text-xs opacity-70 mt-0.5">registered</div>
            </Link>
            <Link href="/dashboard/reports" className="card p-4 hover:shadow-md transition-shadow bg-teal-50 text-teal-700">
              <div className="text-3xl font-bold">{stats.rpts}</div>
              <div className="text-sm font-medium mt-1">Reports this month</div>
              <div className="text-xs opacity-70 mt-0.5">service reports</div>
            </Link>
            <Link href="/dashboard/alerts" className="card p-4 hover:shadow-md transition-shadow bg-red-50 text-red-700">
              <div className="text-3xl font-bold">{stats.overdue}</div>
              <div className="text-sm font-medium mt-1">Cal overdue</div>
              <div className="text-xs opacity-70 mt-0.5">need attention</div>
            </Link>
            <Link href="/dashboard/alerts" className="card p-4 hover:shadow-md transition-shadow bg-amber-50 text-amber-700">
              <div className="text-3xl font-bold">{stats.soon}</div>
              <div className="text-sm font-medium mt-1">Due in 30 days</div>
              <div className="text-xs opacity-70 mt-0.5">due soon</div>
            </Link>
          </div>

          <div className="card">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Calibration alerts - next 90 days</h2>
              <Link href="/dashboard/alerts" className="text-brand-500 text-sm hover:underline">View all</Link>
            </div>
            {alerts.length===0?(
              <div className="px-5 py-8 text-center text-gray-400 text-sm">No calibrations due in the next 90 days!</div>
            ):(
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wider">
                      <th className="px-5 py-3">Instrument</th>
                      <th className="px-5 py-3">Customer</th>
                      <th className="px-5 py-3">Cal due</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {alerts.map(inst=>{
                      const s = calStatus(inst.next_cal_date)
                      return (
                        <tr key={inst.id} className="hover:bg-gray-50">
                          <td className="px-5 py-3 font-medium text-gray-900">{inst.name}</td>
                          <td className="px-5 py-3 text-gray-600">{inst.customer?.name??'—'}</td>
                          <td className="px-5 py-3 text-gray-700">
                            {inst.next_cal_date ? format(parseISO(inst.next_cal_date),'dd MMM yyyy') : '—'}
                          </td>
                          <td className="px-5 py-3">
                            {s==='overdue'?<span className="badge-fail">Overdue</span>
                             :s==='due_soon'?<span className="badge-warn">Due soon</span>
                             :<span className="badge-pass">Current</span>}
                          </td>
                          <td className="px-5 py-3 text-right">
                            <Link href={`/dashboard/instruments/${inst.id}`} className="text-brand-500 text-xs hover:underline">View</Link>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
