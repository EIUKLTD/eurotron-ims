'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

const GAS_OPTIONS = ['CO','CO2','O2','NO','NO2','SO2','H2S','CH4','CxHy','HC','NOx']
const ANALYSER_TYPES = ['Flue Gas','Combustion','Emissions','Portable Multi-gas','Fixed Installation','Process Gas']

export default function EditInstrumentPage() {
  const { id }  = useParams<{ id: string }>()
  const router  = useRouter()
  const supabase = createClient()
  const [customers, setCustomers] = useState<any[]>([])
  const [sites, setSites]         = useState<any[]>([])
  const [filteredSites, setFilteredSites] = useState<any[]>([])
  const [saving, setSaving]       = useState(false)
  const [loading, setLoading]     = useState(true)
  const [form, setForm] = useState<any>({
    customer_id:'', site_id:'', name:'', make:'', model:'',
    serial_number:'', firmware_version:'', asset_tag:'',
    analyser_type:'Flue Gas', gases_measured:[] as string[],
    location:'', cal_interval_months:12, last_cal_date:'',
    next_cal_date:'', purchase_date:'', warranty_expiry:'',
    notes:'', status:'active'
  })

  useEffect(() => {
    async function load() {
      const [{ data: inst }, { data: custs }, { data: s }] = await Promise.all([
        supabase.from('instruments').select('*').eq('id', id).single(),
        supabase.from('customers').select('id,name').order('name'),
        supabase.from('sites').select('*').order('name'),
      ])
      setCustomers(custs||[])
      setSites(s||[])
      if (inst) {
        setForm({
          customer_id: inst.customer_id||'',
          site_id: inst.site_id||'',
          name: inst.name||'',
          make: inst.make||'',
          model: inst.model||'',
          serial_number: inst.serial_number||'',
          firmware_version: inst.firmware_version||'',
          asset_tag: inst.asset_tag||'',
          analyser_type: inst.analyser_type||'Flue Gas',
          gases_measured: inst.gases_measured||[],
          location: inst.location||'',
          cal_interval_months: inst.cal_interval_months||12,
          last_cal_date: inst.last_cal_date||'',
          next_cal_date: inst.next_cal_date||'',
          purchase_date: inst.purchase_date||'',
          warranty_expiry: inst.warranty_expiry||'',
          notes: inst.notes||'',
          status: inst.status||'active'
        })
        setFilteredSites((s||[]).filter((site:any) => site.customer_id === inst.customer_id))
      }
      setLoading(false)
    }
    load()
  }, [id])

 function set(k:string, v:any) {
  setForm((f:any) => {
    const updated = { ...f, [k]: v }
    if (k === 'last_cal_date' || k === 'cal_interval_months') {
      const lastCal = k === 'last_cal_date' ? v : f.last_cal_date
      const months  = k === 'cal_interval_months' ? Number(v) : Number(f.cal_interval_months)
      if (lastCal && months) {
        const due = new Date(lastCal)
        due.setMonth(due.getMonth() + months)
        updated.next_cal_date = due.toISOString().split('T')[0]
      }
    }
    return updated
  })
}

  function handleCustomerChange(customerId:string) {
    set('customer_id', customerId)
    set('site_id', '')
    setFilteredSites(sites.filter(s => s.customer_id === customerId))
  }

  function handleSiteChange(siteId:string) {
    set('site_id', siteId)
    const site = sites.find(s => s.id === siteId)
    if (site) set('location', [site.name, site.address, site.city, site.postcode].filter(Boolean).join(', '))
  }

  function toggleGas(g:string) {
    set('gases_measured', form.gases_measured.includes(g)
      ? form.gases_measured.filter((x:string) => x !== g)
      : [...form.gases_measured, g])
  }

  async function handleSave() {
    if (!form.customer_id) return alert('Please select a customer.')
    if (!form.name) return alert('Instrument name is required.')
    setSaving(true)
    const { error } = await supabase.from('instruments').update({
      ...form,
      cal_interval_months: Number(form.cal_interval_months),
      last_cal_date:   form.last_cal_date   || null,
      next_cal_date:   form.next_cal_date   || null,
      purchase_date:   form.purchase_date   || null,
      warranty_expiry: form.warranty_expiry || null,
      site_id:         form.site_id         || null,
    }).eq('id', id)
    setSaving(false)
    if (error) { 
  if (error.message.includes('unique')) {
    alert('This serial number already exists in the system. Please check the serial number and try again.')
  } else {
    alert(error.message)
  }
  return 
}
    router.push(`/dashboard/instruments/${id}`)
  }

  if (loading) return <div className="p-8 text-gray-400 text-sm">Loading...</div>

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <div className="text-xs text-gray-400 mb-1">
          <a href="/dashboard/instruments" className="hover:text-brand-500">Instruments</a> / Edit
        </div>
        <h1 className="text-2xl font-semibold text-gray-900">Edit instrument</h1>
      </div>

      <div className="card divide-y divide-gray-100">

        {/* Customer & Site */}
        <div className="p-5 space-y-3">
          <h2 className="font-medium text-gray-900 text-sm uppercase tracking-wide">Customer & site</h2>
          <div>
            <label className="label">Customer *</label>
            <select className="input" value={form.customer_id} onChange={e=>handleCustomerChange(e.target.value)}>
              <option value="">Select customer...</option>
              {customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Site</label>
            <select className="input" value={form.site_id} onChange={e=>handleSiteChange(e.target.value)} disabled={!form.customer_id}>
              <option value="">{form.customer_id?'Select site...':'Select a customer first'}</option>
              {filteredSites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>

        {/* Instrument details */}
        <div className="p-5 space-y-3">
          <h2 className="font-medium text-gray-900 text-sm uppercase tracking-wide">Instrument details</h2>
          <div><label className="label">Instrument name *</label><input className="input" value={form.name} onChange={e=>set('name',e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Make</label><input className="input" value={form.make} onChange={e=>set('make',e.target.value)} /></div>
            <div><label className="label">Model</label><input className="input" value={form.model} onChange={e=>set('model',e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Serial number</label><input className="input" value={form.serial_number} onChange={e=>set('serial_number',e.target.value)} /></div>
            <div><label className="label">Asset / tag ID</label><input className="input" value={form.asset_tag} onChange={e=>set('asset_tag',e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Firmware version</label><input className="input" value={form.firmware_version} onChange={e=>set('firmware_version',e.target.value)} /></div>
            <div>
              <label className="label">Analyser type</label>
              <select className="input" value={form.analyser_type} onChange={e=>set('analyser_type',e.target.value)}>
                {ANALYSER_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label mb-2">Gases measured</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {GAS_OPTIONS.map(g=>(
                <button key={g} type="button" onClick={()=>toggleGas(g)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${form.gases_measured.includes(g)?'bg-brand-500 text-white border-brand-500':'bg-white text-gray-600 border-gray-200 hover:border-brand-300'}`}>
                  {g}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Calibration schedule */}
        <div className="p-5 space-y-3">
          <h2 className="font-medium text-gray-900 text-sm uppercase tracking-wide">Calibration schedule</h2>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="label">Interval (months)</label><input className="input" type="number" value={form.cal_interval_months} onChange={e=>set('cal_interval_months',e.target.value)} min={1} /></div>
            <div><label className="label">Last calibration</label><input className="input" type="date" value={form.last_cal_date} onChange={e=>set('last_cal_date',e.target.value)} /></div>
            <div><label className="label">Next cal due</label><input className="input" type="date" value={form.next_cal_date} onChange={e=>set('next_cal_date',e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Purchase date</label><input className="input" type="date" value={form.purchase_date} onChange={e=>set('purchase_date',e.target.value)} /></div>
            <div><label className="label">Warranty expiry</label><input className="input" type="date" value={form.warranty_expiry} onChange={e=>set('warranty_expiry',e.target.value)} /></div>
          </div>
        </div>

        {/* Notes & status */}
        <div className="p-5 space-y-3">
          <div><label className="label">Notes</label><textarea className="input" rows={3} value={form.notes} onChange={e=>set('notes',e.target.value)} /></div>
          <div>
            <label className="label">Status</label>
            <select className="input max-w-xs" value={form.status} onChange={e=>set('status',e.target.value)}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="on_loan">On loan</option>
              <option value="scrapped">Scrapped</option>
            </select>
          </div>
        </div>

        <div className="p-5 flex gap-3">
          <button onClick={handleSave} disabled={saving} className="btn-primary">{saving?'Saving...':'Update instrument'}</button>
          <button onClick={()=>router.back()} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  )
}
