'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import { format, differenceInDays, parseISO } from 'date-fns'
import { useParams } from 'next/navigation'

const SENSOR_KEYWORDS = ['sensor', 'cell', 'pellistor', 'ndir', 'membrapour', 'o2', 'h2s', 'ch4', 'co2', 'electrochemical']

const OUTCOMES: Record<string, { label: string; color: string }> = {
  resolved:     { label: 'Resolved',          color: 'bg-green-100 text-green-700' },
  site_visit:   { label: 'Site visit needed',  color: 'bg-amber-100 text-amber-700' },
  parts_ordered:{ label: 'Parts ordered',      color: 'bg-blue-100 text-blue-700' },
  follow_up:    { label: 'Follow up',           color: 'bg-purple-100 text-purple-700' },
  no_action:    { label: 'No action',           color: 'bg-gray-100 text-gray-500' },
}

const emptyCall = {
  call_date: new Date().toISOString().split('T')[0],
  call_time: new Date().toTimeString().slice(0,5),
  contact_name: '',
  contact_phone: '',
  issue_reported: '',
  action_taken: '',
  outcome: 'resolved',
  follow_up_date: '',
  follow_up_notes: '',
}

export default function InstrumentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [inst, setInst]       = useState<any>(null)
  const [reports, setReports] = useState<any[]>([])
  const [parts, setParts]     = useState<any[]>([])
  const [calls, setCalls]     = useState<any[]>([])
  const [tab, setTab]         = useState<'overview'|'history'|'sensors'|'allparts'|'calls'>('overview')
  const [loading, setLoading] = useState(true)
  const [showCallForm, setShowCallForm] = useState(false)
  const [callForm, setCallForm] = useState<any>(emptyCall)
  const [saving, setSaving]   = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const supabase = createClient()

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    const [{ data: prof }, { data: i }, { data: r }, { data: c }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user!.id).single(),
      supabase.from('instruments').select('*, customer:customers(*), site:sites(*)').eq('id', id).single(),
      supabase.from('service_reports')
        .select('*, engineer:profiles(full_name), report_parts(*)')
        .eq('instrument_id', id)
        .order('visit_date', { ascending: false }),
      supabase.from('call_logs')
        .select('*, logged_by:profiles(full_name)')
        .eq('instrument_id', id)
        .order('call_date', { ascending: false }),
    ])
    setProfile(prof)
    setInst(i)
    setReports(r||[])
    setCalls(c||[])
    const allParts: any[] = []
    ;(r||[]).forEach((report: any) => {
      ;(report.report_parts||[]).forEach((p: any) => {
        allParts.push({
          ...p,
          visit_date: report.visit_date,
          report_number: report.report_number,
          report_id: report.id,
          sage_number: report.sage_number,
          engineer: report.engineer?.full_name ?? '—'
        })
      })
    })
    setParts(allParts)
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  async function saveCall() {
    if (!callForm.issue_reported) return alert('Please describe the issue.')
    setSaving(true)
    const { error } = await supabase.from('call_logs').insert({
      ...callForm,
      instrument_id: id,
      customer_id: inst?.customer_id,
      call_time: callForm.call_time || null,
      follow_up_date: callForm.follow_up_date || null,
      logged_by: profile?.id,
      status: callForm.outcome === 'resolved' || callForm.outcome === 'no_action' ? 'closed' : 'open',
    })
    setSaving(false)
    if (error) { alert(error.message); return }
    setShowCallForm(false); setCallForm(emptyCall); load()
  }

  async function closeCall(callId: string) {
    await supabase.from('call_logs').update({ status: 'closed' }).eq('id', callId)
    load()
  }

  async function deleteCall(callId: string) {
    if (!confirm('Delete this call log?')) return
    await supabase.from('call_logs').delete().eq('id', callId)
    load()
  }

  function setC(k: string, v: string) { setCallForm((f: any) => ({ ...f, [k]: v })) }

  if (loading) return <div className="p-8 text-gray-400 text-sm">Loading...</div>
  if (!inst)   return <div className="p-8 text-gray-400 text-sm">Instrument not found.</div>

  const calDays = inst.next_cal_date ? differenceInDays(parseISO(inst.next_cal_date), new Date()) : null
  const sensorParts = parts.filter(p => SENSOR_KEYWORDS.some(k => p.description?.toLowerCase().includes(k)))
  const openCalls = calls.filter(c => c.status === 'open').length

  const Row = ({ label, value }: { label:string; value?:string|null }) => (
    <div className="grid grid-cols-2 gap-4 py-2.5 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-sm text-gray-900">{value||'—'}</span>
    </div>
  )

  const tabs = [
    { key: 'overview',  label: 'Overview' },
    { key: 'history',   label: `Service history (${reports.length})` },
    { key: 'sensors',   label: `Sensor changes (${sensorParts.length})` },
    { key: 'allparts',  label: `Parts history (${parts.length})` },
    { key: 'calls',     label: `Calls ${openCalls > 0 ? `(${openCalls} open)` : `(${calls.length})`}` },
  ]

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="text-xs text-gray-400 mb-1">
            <Link href="/dashboard/instruments" className="hover:text-brand-500">Instruments</Link> / {inst.name}
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">{inst.name}</h1>
          <p className="text-gray-500 text-sm mt-0.5">{inst.make} {inst.model} &middot; S/N {inst.serial_number??'N/A'}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/dashboard/reports/new?instrument=${inst.id}`} className="btn-primary">+ New report</Link>
          <Link href={`/dashboard/instruments/${inst.id}/edit`} className="btn-secondary">Edit</Link>
        </div>
      </div>

      {calDays!==null&&calDays<30&&(
        <div className={`mb-4 rounded-xl px-4 py-3 text-sm font-medium flex items-center gap-2 ${calDays<0?'bg-red-50 text-red-700':'bg-amber-50 text-amber-700'}`}>
          {calDays<0?`Calibration overdue by ${Math.abs(calDays)} days`:`Calibration due in ${calDays} days`}
          <Link href={`/dashboard/reports/new?instrument=${inst.id}`} className="ml-auto underline text-xs">Start report</Link>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-xl p-1 overflow-x-auto">
        {tabs.map(t=>(
          <button key={t.key} onClick={()=>setTab(t.key as any)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${tab===t.key?'bg-white shadow text-gray-900':'text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {tab==='overview'&&(
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Instrument details</h3>
            <Row label="Customer"       value={inst.customer?.name} />
            <Row label="Site"           value={inst.site?.name} />
            <Row label="Location"       value={inst.location} />
            <Row label="Analyser type"  value={inst.analyser_type} />
            <Row label="Gases measured" value={inst.gases_measured?.join(', ')} />
            <Row label="Make / model"   value={`${inst.make||''} ${inst.model||''}`.trim()} />
            <Row label="Serial number"  value={inst.serial_number} />
            <Row label="Asset / tag ID" value={inst.asset_tag} />
            <Row label="Firmware"       value={inst.firmware_version} />
            <Row label="Status"         value={inst.status} />
          </div>
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Calibration and service</h3>
            <Row label="Cal interval"    value={`${inst.cal_interval_months} months`} />
            <Row label="Last calibration" value={inst.last_cal_date ? format(parseISO(inst.last_cal_date),'dd MMM yyyy') : null} />
            <Row label="Next cal due"    value={inst.next_cal_date ? format(parseISO(inst.next_cal_date),'dd MMM yyyy') : null} />
            <Row label="Last service"    value={inst.last_service_date ? format(parseISO(inst.last_service_date),'dd MMM yyyy') : null} />
            <Row label="Purchase date"   value={inst.purchase_date ? format(parseISO(inst.purchase_date),'dd MMM yyyy') : null} />
            <Row label="Warranty expiry" value={inst.warranty_expiry ? format(parseISO(inst.warranty_expiry),'dd MMM yyyy') : null} />
            {inst.notes&&<div className="mt-3 text-xs text-gray-500 bg-gray-50 rounded-lg p-3">{inst.notes}</div>}
          </div>
        </div>
      )}

      {/* Service history tab */}
      {tab==='history'&&(
        <div className="card overflow-hidden">
          {reports.length===0?(
            <div className="p-8 text-center text-gray-400 text-sm">
              No service reports yet. <Link href={`/dashboard/reports/new?instrument=${inst.id}`} className="text-brand-500 hover:underline">Create the first one</Link>
            </div>
          ):(
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase bg-gray-50">
                  <th className="px-5 py-3 text-left">Report no.</th>
                  <th className="px-5 py-3 text-left">Sage no.</th>
                  <th className="px-5 py-3 text-left">Date</th>
                  <th className="px-5 py-3 text-left">Engineer</th>
                  <th className="px-5 py-3 text-left">Result</th>
                  <th className="px-5 py-3 text-left">Status</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {reports.map(r=>(
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-mono text-xs text-gray-700">{r.report_number}</td>
                    <td className="px-5 py-3 font-mono text-xs text-brand-600">{r.sage_number??'—'}</td>
                    <td className="px-5 py-3 text-gray-700">{format(parseISO(r.visit_date),'dd MMM yyyy')}</td>
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
                      <Link href={`/dashboard/reports/${r.id}`} className="text-brand-500 text-xs hover:underline">View</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Sensor changes tab */}
      {tab==='sensors'&&(
        <div>
          {sensorParts.length===0?(
            <div className="card p-8 text-center text-gray-400 text-sm">No sensor changes recorded yet.</div>
          ):(
            <div className="relative">
              <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-brand-100"></div>
              <div className="space-y-4">
                {sensorParts.map((p) => (
                  <div key={p.id} className="relative flex gap-4">
                    <div className="shrink-0 w-12 flex items-start justify-center pt-3">
                      <div className="w-3 h-3 rounded-full bg-brand-500 border-2 border-white shadow"></div>
                    </div>
                    <div className="card p-4 flex-1">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="font-medium text-gray-900 text-sm">{p.description}</div>
                          {p.part_number && <div className="text-xs text-gray-400 font-mono mt-0.5">{p.part_number}</div>}
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${p.warranty==='yes'?'bg-green-100 text-green-700':p.warranty==='no'?'bg-red-100 text-red-600':'bg-gray-100 text-gray-500'}`}>
                          {p.warranty==='yes'?'Warranty':p.warranty==='no'?'No warranty':'—'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                        <span>{p.visit_date ? format(parseISO(p.visit_date),'dd MMM yyyy') : '—'}</span>
                        <span>&middot;</span><span>{p.engineer}</span>
                        <span>&middot;</span>
                        <Link href={`/dashboard/reports/${p.report_id}`} className="text-brand-500 hover:underline">{p.report_number}</Link>
                        {p.sage_number && <><span>&middot;</span><span className="font-mono text-brand-600">{p.sage_number}</span></>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* All parts tab */}
      {tab==='allparts'&&(
        <div className="card overflow-hidden">
          {parts.length===0?(
            <div className="p-8 text-center text-gray-400 text-sm">No parts recorded yet.</div>
          ):(
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase bg-gray-50">
                  <th className="px-5 py-3 text-left">Part description</th>
                  <th className="px-5 py-3 text-left">Part number</th>
                  <th className="px-5 py-3 text-left">Date</th>
                  <th className="px-5 py-3 text-left">Engineer</th>
                  <th className="px-5 py-3 text-left">Report</th>
                  <th className="px-5 py-3 text-left">Warranty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {parts.map((p, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-900">{p.description}</td>
                    <td className="px-5 py-3 font-mono text-xs text-gray-500">{p.part_number??'—'}</td>
                    <td className="px-5 py-3 text-gray-700 whitespace-nowrap">{p.visit_date ? format(parseISO(p.visit_date),'dd MMM yyyy') : '—'}</td>
                    <td className="px-5 py-3 text-gray-600">{p.engineer}</td>
                    <td className="px-5 py-3">
                      <Link href={`/dashboard/reports/${p.report_id}`} className="text-brand-500 text-xs hover:underline font-mono">{p.report_number}</Link>
                      {p.sage_number && <div className="text-xs text-brand-600 font-mono">{p.sage_number}</div>}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.warranty==='yes'?'bg-green-100 text-green-700':p.warranty==='no'?'bg-red-100 text-red-600':'bg-gray-100 text-gray-500'}`}>
                        {p.warranty==='yes'?'Warranty':p.warranty==='no'?'No warranty':'—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Calls tab */}
      {tab==='calls'&&(
        <div className="space-y-3">
          <div className="flex justify-end">
            <button onClick={()=>setShowCallForm(!showCallForm)} className="btn-primary">+ Log call</button>
          </div>

          {showCallForm && (
            <div className="card p-5">
              <h2 className="font-semibold text-gray-900 mb-4">Log a call for {inst.name}</h2>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Date</label><input className="input" type="date" value={callForm.call_date} onChange={e=>setC('call_date',e.target.value)} /></div>
                <div><label className="label">Time</label><input className="input" type="time" value={callForm.call_time} onChange={e=>setC('call_time',e.target.value)} /></div>
                <div><label className="label">Contact name</label><input className="input" value={callForm.contact_name} onChange={e=>setC('contact_name',e.target.value)} placeholder="Who called?" /></div>
                <div><label className="label">Contact phone</label><input className="input" value={callForm.contact_phone} onChange={e=>setC('contact_phone',e.target.value)} placeholder="Phone number" /></div>
                <div className="col-span-2">
                  <label className="label">Issue reported *</label>
                  <textarea className="input" rows={3} value={callForm.issue_reported} onChange={e=>setC('issue_reported',e.target.value)} placeholder="Describe what the customer reported..." />
                </div>
                <div className="col-span-2">
                  <label className="label">Action taken / advice given</label>
                  <textarea className="input" rows={3} value={callForm.action_taken} onChange={e=>setC('action_taken',e.target.value)} placeholder="What did you advise or action?" />
                </div>
                <div>
                  <label className="label">Outcome</label>
                  <select className="input" value={callForm.outcome} onChange={e=>setC('outcome',e.target.value)}>
                    {Object.entries(OUTCOMES).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div><label className="label">Follow-up date</label><input className="input" type="date" value={callForm.follow_up_date} onChange={e=>setC('follow_up_date',e.target.value)} /></div>
                <div className="col-span-2">
                  <label className="label">Follow-up notes</label>
                  <input className="input" value={callForm.follow_up_notes} onChange={e=>setC('follow_up_notes',e.target.value)} placeholder="Any follow-up notes..." />
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                <button onClick={saveCall} disabled={saving} className="btn-primary">{saving?'Saving...':'Save call log'}</button>
                <button onClick={()=>{setShowCallForm(false);setCallForm(emptyCall)}} className="btn-secondary">Cancel</button>
              </div>
            </div>
          )}

          {calls.length===0 && !showCallForm ? (
            <div className="card p-8 text-center text-gray-400 text-sm">No calls logged for this instrument yet.</div>
          ) : (
            calls.map(call => (
              <div key={call.id} className={`card p-4 border-l-4 ${call.status==='open'?'border-amber-400':'border-green-400'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${OUTCOMES[call.outcome]?.color??'bg-gray-100 text-gray-500'}`}>
                        {OUTCOMES[call.outcome]?.label??call.outcome}
                      </span>
                      {call.status==='closed' && <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700">Closed</span>}
                    </div>
                    <div className="text-xs text-gray-400 mt-1 flex items-center gap-2">
                      <span>{call.call_date ? format(parseISO(call.call_date),'dd MMM yyyy') : '—'}</span>
                      {call.call_time && <><span>·</span><span>{call.call_time}</span></>}
                      {call.contact_name && <><span>·</span><span>From: {call.contact_name}</span></>}
                      {call.contact_phone && <><span>·</span><span>{call.contact_phone}</span></>}
                      <span>·</span><span>Logged by: {call.logged_by?.full_name??'—'}</span>
                    </div>
                    <div className="mt-2">
                      <p className="text-sm text-gray-800"><span className="text-xs text-gray-400 font-medium">Issue: </span>{call.issue_reported}</p>
                      {call.action_taken && <p className="text-sm text-gray-600 mt-1"><span className="text-xs text-gray-400 font-medium">Action: </span>{call.action_taken}</p>}
                      {call.follow_up_notes && <p className="text-sm text-gray-500 mt-1 italic"><span className="text-xs text-gray-400 font-medium">Follow-up: </span>{call.follow_up_notes}</p>}
                      {call.follow_up_date && <p className="text-xs text-purple-600 mt-1 font-medium">Follow-up due: {format(parseISO(call.follow_up_date),'dd MMM yyyy')}</p>}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    {call.status==='open' && <button onClick={()=>closeCall(call.id)} className="text-xs text-green-600 hover:underline">Mark closed</button>}
                    <Link href={`/dashboard/reports/new?instrument=${id}`} className="text-xs text-brand-500 hover:underline">New report</Link>
                    <button onClick={()=>deleteCall(call.id)} className="text-xs text-red-400 hover:underline">Delete</button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
