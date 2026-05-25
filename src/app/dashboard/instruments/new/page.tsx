'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const GAS_OPTIONS = ['CO','CO2','O2','NO','NO2','SO2','H2S','CH4','CxHy','HC','NOx']
const ANALYSER_TYPES = ['Flue Gas','Combustion','Emissions','Portable Multi-gas','Fixed Installation','Process Gas']

export default function NewInstrumentPage() {
  const router   = useRouter()
  const supabase = createClient()
  const [customers, setCustomers]   = useState<any[]>([])
  const [sites, setSites]           = useState<any[]>([])
  const [models, setModels]         = useState<any[]>([])
  const [filteredSites, setFilteredSites] = useState<any[]>([])
  const [saving, setSaving]         = useState(false)
  const [form, setForm] = useState<any>({
    customer_id:'', site_id:'', name:'', make:'MRU', model:'',
    serial_number:'', firmware_version:'', asset_tag:'',
    analyser_type:'Fixed Installation', gases_measured:[] as string[],
    location:'', cal_interval_months:12, last_cal_date:'',
    next_cal_date:'', purchase_date:'', warranty_expiry:'',
    notes:'', status:'active'
  })

  useEffect(() => {
    Promise.all([
      supabase.from('customers').select('id,name').order('name'),
      supabase.from('sites').select('*').order('name'),
      supabase.from('instrument_models').select('*').eq('active', true).order('name'),
    ]).then(([{ data: c }, { data: s }, { data: m }]) => {
      setCustomers(c||[])
      setSites(s||[])
      setModels(m||[])
    })
  }, [])

  function set(k:string, v:any) { setForm((f:any) => ({ ...f, [k]: v })) }

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

  function handleModelChange(modelId:string) {
    if (!modelId) return
    const m = models.find(m => m.id === modelId)
    if (m) {
      set('make', m.make)
      set('model', m.model)
      set('analyser_type', m.analyser_type || 'Fixed Installation')
      set('name', m.name)
    }
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
    const { error } = await supabase.from('instruments').insert({
      ...form,
      cal_interval_months: Number(form.cal_interval_months),
      last_cal_date:   form.last_cal_date   || null,
      next_cal_date:   form.next_cal_date   || null,
      purchase_date:   form.purchase_date   || null,
      warranty_expiry: form.warranty_expiry || null,
      site_id:         form.site_id         || null,
    })
    setSaving(false)
    if (error) { alert(error.message); return }
    router.push('/dashboard/instruments')
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <div className="text-xs text-gray-400 mb-1">
          <a href="/dashboard/instruments" className="hover:text-brand-500">Instruments</a> / New
        </div>
        <h1 className="text-2xl font-semibold text-gray-900">Add instrument</h1>
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

        {/* Instrument model selector */}
        <div className="p-5 space-y-3">
          <h2 className="font-medium text-gray-900 text-sm uppercase tracking-wide">Instrument model</h2>
          <div>
            <label className="label">Select model (auto-fills details)</label>
            <select className="input" onChange={e=>handleModelChange(e.target.value)}>
              <option value="">Select a model...</option>
              {models.map(m=><option key={m.id} value={m.id}>{m.make} {m.model}</option>)}
            </select>
          </div>
        </div>

        {/* Instrument details */}
        <div className="p-5 space-y-3">
          <h2 className="font-medium text-gray-900 text-sm uppercase tracking-wide">Instrument details</h2>
          <div><label className="label">Instrument name *</label><input className="input" value={form.name} onChange={e=>set('name',e.target.value)} placeholder="e.g. FIXED GAS ANALYSER" /></div>
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
          <button onClick={handleSave} disabled={saving} className="btn-primary">{saving?'Saving...':'Save instrument'}</button>
          <button onClick={()=>router.back()} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  )
}
