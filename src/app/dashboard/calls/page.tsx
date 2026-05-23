'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'

const OUTCOMES: Record<string, { label: string; color: string }> = {
  resolved:     { label: 'Resolved',        color: 'bg-green-100 text-green-700' },
  site_visit:   { label: 'Site visit needed', color: 'bg-amber-100 text-amber-700' },
  parts_ordered:{ label: 'Parts ordered',   color: 'bg-blue-100 text-blue-700' },
  follow_up:    { label: 'Follow up',        color: 'bg-purple-100 text-purple-700' },
  no_action:    { label: 'No action',        color: 'bg-gray-100 text-gray-500' },
}

const empty = {
  call_date: new Date().toISOString().split('T')[0],
  call_time: new Date().toTimeString().slice(0,5),
  customer_id: '',
  instrument_id: '',
  contact_name: '',
  contact_phone: '',
  issue_reported: '',
  action_taken: '',
  outcome: 'resolved',
  follow_up_date: '',
  follow_up_notes: '',
  status: 'open',
}

export default function CallsPage() {
  const [calls, setCalls]           = useState<any[]>([])
  const [customers, setCustomers]   = useState<any[]>([])
  const [instruments, setInstruments] = useState<any[]>([])
  const [filteredInstruments, setFilteredInstruments] = useState<any[]>([])
  const [loading, setLoading]       = useState(true)
  const [showForm, setShowForm]     = useState(false)
  const [form, setForm]             = useState<any>(empty)
  const [saving, setSaving]         = useState(false)
  const [filter, setFilter]         = useState('all')
  const [profile, setProfile]       = useState<any>(null)
  const supabase = createClient()

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    const [{ data: prof }, { data: c }, { data: i }, { data: logs }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user!.id).single(),
      supabase.from('customers').select('id,name').order('name'),
      supabase.from('instruments').select('id,name,serial_number,customer_id').order('name'),
      supabase.from('call_logs')
        .select('*, customer:customers(name), instrument:instruments(name,serial_number), logged_by:profiles(full_name)')
        .order('call_date', { ascending: false })
        .order('call_time', { ascending: false })
    ])
    setProfile(prof)
    setCustomers(c||[])
    setInstruments(i||[])
    setCalls(logs||[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function handleCustomerChange(customerId: string) {
    setForm((f: any) => ({ ...f, customer_id: customerId, instrument_id: '' }))
    setFilteredInstruments(instruments.filter(i => i.customer_id === customerId))
  }

  async function save() {
    if (!form.customer_id) return alert('Please select a customer.')
    if (!form.issue_reported) return alert('Please describe the issue.')
    setSaving(true)
    const { error } = await supabase.from('call_logs').insert({
      ...form,
      call_time:    form.call_time || null,
      instrument_id: form.instrument_id || null,
      follow_up_date: form.follow_up_date || null,
      logged_by:    profile?.id,
      status:       form.outcome === 'resolved' || form.outcome === 'no_action' ? 'closed' : 'open',
    })
    setSaving(false)
    if (error) { alert(error.message); return }
    setShowForm(false); setForm(empty); load()
  }

  function set(k: string, v: string) { setForm((f: any) => ({ ...f, [k]: v })) }

  const filtered = calls.filter(c => {
    if (filter === 'open')   return c.status === 'open'
    if (filter === 'closed') return c.status === 'closed'
    return true
  })

  const openCount   = calls.filter(c => c.status === 'open').length
  const closedCount = calls.filter(c => c.status === 'closed').length

  async function closeCall(id: string) {
    await supabase.from('call_logs').update({ status: 'closed' }).eq('id', id)
    load()
  }

  async function deleteCall(id: string) {
    if (!confirm('Delete this call log?')) return
    await supabase.from('call_logs').delete().eq('id', id)
    load()
  }

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Call log</h1>
          <p className="text-gray-500 text-sm mt-1">
            {openCount} open &middot; {closedCount} closed
          </p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">+ Log call</button>
      </div>

      {/* New call form */}
      {showForm && (
        <div className="card p-5 mb-5">
          <h2 className="font-semibold text-gray-900 mb-4">Log a new call</h2>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Date</label><input className="input" type="date" value={form.call_date} onChange={e=>set('call_date',e.target.value)} /></div>
            <div><label className="label">Time</label><input className="input" type="time" value={form.call_time} onChange={e=>set('call_time',e.target.value)} /></div>
            <div>
              <label className="label">Customer *</label>
              <select className="input" value={form.customer_id} onChange={e=>handleCustomerChange(e.target.value)}>
                <option value="">Select customer...</option>
                {customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Instrument</label>
              <select className="input" value={form.instrument_id} onChange={e=>set('instrument_id',e.target.value)} disabled={!form.customer_id}>
                <option value="">{form.customer_id ? 'Select instrument...' : 'Select customer first'}</option>
                {filteredInstruments.map(i=><option key={i.id} value={i.id}>{i.name} (S/N: {i.serial_number??'N/A'})</option>)}
              </select>
            </div>
            <div><label className="label">Contact name</label><input className="input" value={form.contact_name} onChange={e=>set('contact_name',e.target.value)} placeholder="Who called?" /></div>
            <div><label className="label">Contact phone</label><input className="input" value={form.contact_phone} onChange={e=>set('contact_phone',e.target.value)} placeholder="Phone number" /></div>
            <div className="col-span-2">
              <label className="label">Issue reported *</label>
              <textarea className="input" rows={3} value={form.issue_reported} onChange={e=>set('issue_reported',e.target.value)} placeholder="Describe what the customer reported..." />
            </div>
            <div className="col-span-2">
              <label className="label">Action taken / advice given</label>
              <textarea className="input" rows={3} value={form.action_taken} onChange={e=>set('action_taken',e.target.value)} placeholder="What did you advise or action?" />
            </div>
            <div>
              <label className="label">Outcome</label>
              <select className="input" value={form.outcome} onChange={e=>set('outcome',e.target.value)}>
                {Object.entries(OUTCOMES).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div><label className="label">Follow-up date</label><input className="input" type="date" value={form.follow_up_date} onChange={e=>set('follow_up_date',e.target.value)} /></div>
            <div className="col-span-2">
              <label className="label">Follow-up notes</label>
              <input className="input" value={form.follow_up_notes} onChange={e=>set('follow_up_notes',e.target.value)} placeholder="Any follow-up notes..." />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={save} disabled={saving} className="btn-primary">{saving?'Saving...':'Save call log'}</button>
            <button onClick={()=>{setShowForm(false);setForm(empty)}} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-xl p-1 w-fit">
        {[['all','All calls'],['open','Open'],['closed','Closed']].map(([k,l])=>(
          <button key={k} onClick={()=>setFilter(k)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter===k?'bg-white shadow text-gray-900':'text-gray-500 hover:text-gray-700'}`}>
            {l}
          </button>
        ))}
      </div>

      {/* Calls list */}
      {loading ? (
        <div className="card p-8 text-center text-gray-400 text-sm">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="card p-8 text-center text-gray-400 text-sm">
          No calls logged yet. Click "+ Log call" to record your first one!
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(call => (
            <div key={call.id} className={`card p-4 border-l-4 ${call.status==='open'?'border-amber-400':'border-green-400'}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900">{call.customer?.name??'—'}</span>
                    {call.instrument && (
                      <>
                        <span className="text-gray-400">·</span>
                        <Link href={`/dashboard/instruments/${call.instrument_id}`} className="text-brand-500 text-sm hover:underline">
                          {call.instrument.name} (S/N: {call.instrument.serial_number??'N/A'})
                        </Link>
                      </>
                    )}
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
                  {call.status==='open' && (
                    <button onClick={()=>closeCall(call.id)} className="text-xs text-green-600 hover:underline whitespace-nowrap">Mark closed</button>
                  )}
                  {call.instrument_id && (
                    <Link href={`/dashboard/reports/new?instrument=${call.instrument_id}`} className="text-xs text-brand-500 hover:underline whitespace-nowrap">New report</Link>
                  )}
                  <button onClick={()=>deleteCall(call.id)} className="text-xs text-red-400 hover:underline">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
