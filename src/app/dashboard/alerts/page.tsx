'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import { format, differenceInDays, parseISO } from 'date-fns'

type Tab = 'overdue' | 'soon' | 'upcoming'

export default function AlertsPage() {
  const [all, setAll] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('overdue')
  const supabase = createClient()

  useEffect(() => {
    const in90 = new Date(Date.now()+90*86400000).toISOString().split('T')[0]
    supabase.from('instruments')
      .select('*, customer:customers(name,contact_email)')
      .eq('status','active')
      .lte('next_cal_date', in90)
      .order('next_cal_date')
      .then(({ data }) => { setAll(data||[]); setLoading(false) })
  }, [])

  const today = new Date()

  function categorise(i:any) {
    if (!i.next_cal_date) return 'upcoming'
    const d = differenceInDays(parseISO(i.next_cal_date), today)
    if (d < 0) return 'overdue'
    if (d <= 30) return 'soon'
    return 'upcoming'
  }

  const overdue  = all.filter(i=>categorise(i)==='overdue')
  const soon     = all.filter(i=>categorise(i)==='soon')
  const upcoming = all.filter(i=>categorise(i)==='upcoming')
  const shown    = tab==='overdue'?overdue:tab==='soon'?soon:upcoming

  const tabs = [
    { key:'overdue'  as Tab, label:'Overdue',          count:overdue.length,  colour:'text-red-600'   },
    { key:'soon'     as Tab, label:'Due in 30 days',   count:soon.length,     colour:'text-amber-600' },
    { key:'upcoming' as Tab, label:'Due in 31-90 days',count:upcoming.length, colour:'text-blue-600'  },
  ]

  async function sendReminder(inst:any) {
    const email = inst.customer?.contact_email
    if (!email) return alert('No customer email on file.')
    const days = inst.next_cal_date ? differenceInDays(parseISO(inst.next_cal_date), today) : 0
    const subject = `Calibration ${days<0?'overdue':'reminder'} - ${inst.name} (${inst.serial_number??''})`
    const body = `Dear ${inst.customer?.name??'Customer'},\n\nThis is a reminder that calibration for the following instrument is ${days<0?'overdue':'due soon'}:\n\nInstrument: ${inst.name}\nSerial: ${inst.serial_number??'N/A'}\nCal due: ${inst.next_cal_date??'N/A'}\n\nPlease contact us to schedule a visit.\n\nKind regards,\nEurotron Instruments (UK) Ltd`
    window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

  return (
    <div className="p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Calibration alerts</h1>
        <p className="text-gray-500 text-sm mt-1">Instruments due or overdue for calibration in the next 90 days</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {tabs.map(t=>(
          <button key={t.key} onClick={()=>setTab(t.key)}
            className={`card p-4 text-left transition-all hover:shadow-md ${tab===t.key?'ring-2 ring-brand-500':''}`}>
            <div className={`text-3xl font-bold ${t.colour}`}>{t.count}</div>
            <div className="text-sm font-medium text-gray-700 mt-1">{t.label}</div>
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 text-sm font-medium text-gray-700">
          {tabs.find(t=>t.key===tab)?.label} - {shown.length} instrument{shown.length!==1?'s':''}
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading...</div>
        ) : shown.length===0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">No instruments in this category.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase text-left">
                <th className="px-5 py-3">Instrument</th>
                <th className="px-5 py-3">Customer</th>
                <th className="px-5 py-3">Serial</th>
                <th className="px-5 py-3">Cal due</th>
                <th className="px-5 py-3">Days</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {shown.map(inst=>{
                const days = inst.next_cal_date ? differenceInDays(parseISO(inst.next_cal_date), today) : null
                return (
                  <tr key={inst.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <div className="font-medium text-gray-900">{inst.name}</div>
                      <div className="text-xs text-gray-400">{inst.make} {inst.model}</div>
                    </td>
                    <td className="px-5 py-3 text-gray-700">{inst.customer?.name??'—'}</td>
                    <td className="px-5 py-3 text-gray-500">{inst.serial_number??'—'}</td>
                    <td className="px-5 py-3 text-gray-700 whitespace-nowrap">
                      {inst.next_cal_date ? format(parseISO(inst.next_cal_date),'dd MMM yyyy') : '—'}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`font-semibold ${days!==null&&days<0?'text-red-600':days!==null&&days<=30?'text-amber-600':'text-blue-600'}`}>
                        {days!==null?(days<0?`${Math.abs(days)} overdue`:`${days} days`):'—'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right space-x-3">
                      <Link href={`/dashboard/instruments/${inst.id}`} className="text-brand-500 text-xs hover:underline">View</Link>
                      <Link href={`/dashboard/reports/new?instrument=${inst.id}`} className="text-teal-600 text-xs hover:underline">New report</Link>
                      <button onClick={()=>sendReminder(inst)} className="text-amber-600 text-xs hover:underline">Email reminder</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
