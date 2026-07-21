'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const GAS_OPTIONS = ['CO','CO2','O2','NO','NO2','SO2','H2S','CH4','CxHy','HC','NOx']
const ANALYSER_TYPES = ['Flue Gas','Combustion','Emissions','Portable Multi-gas','Fixed Installation','Process Gas']
const PRESSURE_UNITS = ['bar','mbar','psi','kPa','MPa','inH2O','mmHg']
const CONNECTIONS = ['1/4" BSP MALE','1/4" BSP FEMALE','1/2" BSP MALE','1/2" BSP FEMALE','1/4" NPT MALE','1/2" NPT MALE','Other']
const GAUGE_TYPES = ['Gauge','Absolute','Differential','Compound']
const CATEGORIES = [
  { key: 'gas_analyser',   label: '🔬 Gas Analyser' },
  { key: 'pressure_gauge', label: '📊 Pressure Gauge' },
  { key: 'temperature',    label: '🌡 Temperature' },
  { key: 'flow',           label: '💧 Flow' },
  { key: 'electrical',     label: '⚡ Electrical' },
  { key: 'other',          label: '🔧 Other' },
]

export default function NewInstrumentPage() {
  const router   = useRouter()
  const supabase = createClient()
  const [customers, setCustomers]     = useState<any[]>([])
  const [sites, setSites]             = useState<any[]>([])
  const [models, setModels]           = useState<any[]>([])
  const [filteredSites, setFilteredSites] = useState<any[]>([])
  const [filteredModels, setFilteredModels] = useState<any[]>([])
  const [saving, setSaving]           = useState(false)
  const [form, setForm] = useState<any>({
    instrument_category: 'gas_analyser',
    customer_id: '', site_id: '', name: '', make: '', model: '',
    serial_number: '', firmware_version: '', asset_tag: '',
    analyser_type: 'Fixed Installation', gases_measured: [] as string[],
    location: '', cal_interval_months: 12, last_cal_date: '',
    next_cal_date: '', purchase_date: '', warranty_expiry: '',
    notes: '', status: 'active',
    decimal_places: 2, pressure_range: '', vacuum_range: '',
    pressure_unit: 'bar', accuracy_pct_fs: 0.05,
    gauge_type: 'Gauge', pressure_connection: '1/2" BSP FEMALE',
  })

  useEffect(() => {
    Promise.all([
      supabase.from('customers').select('id,name').order('name'),
      supabase.from('sites').select('*').order('name'),
      supabase.from('instrument_models').select('*').eq('active', true).order('make').order('model'),
    ]).then(([{ data: c }, { data: s }, { data: m }]) => {
      setCustomers(c||[]); setSites(s||[]); setModels(m||[])
    })
  }, [])

  // Filter models by category
  useEffect(() => {
    setFilteredModels(models.filter(m => (m.instrument_category || 'gas_analyser') === form.instrument_category))
  }, [form.instrument_category, models])

  function set(k:string, v:any) { setForm((f:any) => ({ ...f, [k]: v })) }

  function handleCategoryChange(cat: string) {
    set('instrument_category', cat)
    // Reset model-specific fields
    set('make', ''); set('model', ''); set('name', '')
    set('gases_measured', [])
  }

  function handleCustomerChange(customerId:string) {
    set('customer_id', customerId); set('site_id', '')
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
    if (!m) return
    set('make', m.make || '')
    set('model', m.model || '')
    set('name', '')
    set('analyser_type', m.analyser_type || 'Fixed Installation')
    // Pressure gauge model fields
    if (m.instrument_category === 'pressure_gauge') {
      if (m.pressure_range)     set('pressure_range', m.pressure_range)
      if (m.vacuum_range)       set('vacuum_range', m.vacuum_range)
      if (m.pressure_unit)      set('pressure_unit', m.pressure_unit)
      if (m.accuracy_pct_fs)    set('accuracy_pct_fs', m.accuracy_pct_fs)
      if (m.decimal_places)     set('decimal_places', m.decimal_places)
      if (m.gauge_type)         set('gauge_type', m.gauge_type)
      if (m.pressure_connection) set('pressure_connection', m.pressure_connection)
    }
  }

  function toggleGas(g:string) {
    set('gases_measured', form.gases_measured.includes(g)
      ? form.gases_measured.filter((x:string) => x !== g)
      : [...form.gases_measured, g])
  }

  function getResolution() {
    return Math.pow(10, -form.decimal_places).toFixed(form.decimal_places)
  }

  function getTolerance() {
    if (!form.pressure_range || !form.accuracy_pct_fs) return null
    return (form.accuracy_pct_fs * parseFloat(form.pressure_range) / 100).toFixed(form.decimal_places)
  }

  async function handleSave() {
    if (!form.customer_id) return alert('Please select a customer.')
    if (!form.name && !form.make) return alert('Please enter instrument name or select a model.')
    if (form.instrument_category === 'pressure_gauge' && !form.pressure_range) return alert('Please enter a pressure range.')
    setSaving(true)
    const { error } = await supabase.from('instruments').insert({
      ...form,
      name: form.name || `${form.make} ${form.model}`,
      cal_interval_months: Number(form.cal_interval_months),
      last_cal_date:   form.last_cal_date   || null,
      next_cal_date:   form.next_cal_date   || null,
      purchase_date:   form.purchase_date   || null,
      warranty_expiry: form.warranty_expiry || null,
      site_id:         form.site_id         || null,
      pressure_range:  form.pressure_range  ? parseFloat(form.pressure_range)  : null,
      vacuum_range:    form.vacuum_range    ? parseFloat(form.vacuum_range)    : null,
      accuracy_pct_fs: parseFloat(form.accuracy_pct_fs),
      decimal_places:  parseInt(form.decimal_places),
    })
    setSaving(false)
    if (error) {
      if (error.message.includes('unique')) {
        alert('This serial number already exists. Please check and try again.')
      } else {
        alert(error.message)
      }
      return
    }
    router.push('/dashboard/instruments')
  }

  const isPressure = form.instrument_category === 'pressure_gauge'
  const isGasAnalyser = form.instrument_category === 'gas_analyser'

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <div className="text-xs text-gray-400 mb-1">
          <a href="/dashboard/instruments" className="hover:text-brand-500">Instruments</a> / New
        </div>
        <h1 className="text-2xl font-semibold text-gray-900">Add instrument</h1>
      </div>

      <div className="card divide-y divide-gray-100">

        {/* Category selector */}
        <div className="p-5 space-y-3">
          <h2 className="font-medium text-gray-700 text-sm uppercase tracking-wide">Instrument category</h2>
          <div className="grid grid-cols-3 gap-2">
            {CATEGORIES.map(cat => (
              <button key={cat.key} onClick={() => handleCategoryChange(cat.key)}
                className={`py-2.5 px-3 rounded-xl border-2 text-xs font-medium text-left transition-colors ${form.instrument_category === cat.key ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'}`}>
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Customer & Site */}
        <div className="p-5 space-y-3">
          <h2 className="font-medium text-gray-700 text-sm uppercase tracking-wide">Customer & site</h2>
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
              <option value="">{form.customer_id ? 'Select site...' : 'Select a customer first'}</option>
              {filteredSites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>

        {/* Model selector */}
        {filteredModels.length > 0 && (
          <div className="p-5 space-y-3">
            <h2 className="font-medium text-gray-700 text-sm uppercase tracking-wide">
              Model <span className="text-gray-400 font-normal normal-case">(auto-fills details)</span>
            </h2>
            <select className="input" onChange={e=>handleModelChange(e.target.value)}>
              <option value="">Select a model to auto-fill...</option>
              {filteredModels.map(m=><option key={m.id} value={m.id}>{m.make} {m.model}{m.pressure_range ? ` — 0 to ${m.pressure_range} ${m.pressure_unit}` : ''}</option>)}
            </select>
          </div>
        )}

        {/* Instrument details */}
        <div className="p-5 space-y-3">
          <h2 className="font-medium text-gray-700 text-sm uppercase tracking-wide">Instrument details</h2>
          <div>
            <label className="label">Instrument type</label>
            <select className="input" value={form.name} onChange={e=>set('name',e.target.value)}>
              <option value="">Select type...</option>
              {isPressure && <>
                <option>Digital Pressure Gauge</option>
                <option>Analogue Pressure Gauge</option>
                <option>Digital Compound Gauge</option>
                <option>Analogue Compound Gauge</option>
                <option>Differential Pressure Gauge</option>
              </>}
              {isGasAnalyser && <>
                <option>Fixed Gas Analyser</option>
                <option>Portable Gas Analyser</option>
                <option>Flue Gas Analyser</option>
                <option>Process Gas Analyser</option>
              </>}
              {!isPressure && !isGasAnalyser && <>
                <option>Temperature Instrument</option>
                <option>Flow Meter</option>
                <option>Electrical Instrument</option>
                <option>Other Instrument</option>
              </>}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Make</label><input className="input" value={form.make} onChange={e=>set('make',e.target.value)} placeholder="e.g. Wika, Druck, MRU" /></div>
            <div><label className="label">Model</label><input className="input" value={form.model} onChange={e=>set('model',e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Serial number</label><input className="input" value={form.serial_number} onChange={e=>set('serial_number',e.target.value)} /></div>
            <div><label className="label">Asset / tag ID</label><input className="input" value={form.asset_tag} onChange={e=>set('asset_tag',e.target.value)} /></div>
          </div>

          {/* Gas analyser specific */}
          {isGasAnalyser && (
            <>
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
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${form.gases_measured.includes(g) ? 'bg-brand-500 text-white border-brand-500' : 'bg-white text-gray-600 border-gray-200 hover:border-brand-300'}`}>
                      {g}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Pressure gauge specific */}
          {isPressure && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Pressure unit</label>
                  <select className="input" value={form.pressure_unit} onChange={e=>set('pressure_unit',e.target.value)}>
                    {PRESSURE_UNITS.map(u=><option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Gauge type</label>
                  <select className="input" value={form.gauge_type} onChange={e=>set('gauge_type',e.target.value)}>
                    {GAUGE_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Pressure range ({form.pressure_unit}) *</label><input className="input" type="number" step="any" value={form.pressure_range} onChange={e=>set('pressure_range',e.target.value)} placeholder="e.g. 20" /></div>
                <div><label className="label">Vacuum range ({form.pressure_unit})</label><input className="input" type="number" step="any" value={form.vacuum_range} onChange={e=>set('vacuum_range',e.target.value)} placeholder="e.g. -1" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Accuracy (%FS)</label><input className="input" type="number" step="0.001" value={form.accuracy_pct_fs} onChange={e=>set('accuracy_pct_fs',e.target.value)} /></div>
                <div>
                  <label className="label">Decimal places</label>
                  <select className="input" value={form.decimal_places} onChange={e=>set('decimal_places',parseInt(e.target.value))}>
                    {[1,2,3,4,5].map(n=><option key={n} value={n}>{n} decimal places</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Pressure connection</label>
                <select className="input" value={form.pressure_connection} onChange={e=>set('pressure_connection',e.target.value)}>
                  {CONNECTIONS.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {form.pressure_range && (
                <div className="bg-brand-50 rounded-xl p-3 text-xs space-y-1">
                  <div className="flex justify-between"><span className="text-gray-500">Resolution</span><span className="font-mono font-semibold text-brand-700">{getResolution()} {form.pressure_unit}</span></div>
                  {getTolerance() && <div className="flex justify-between"><span className="text-gray-500">Tolerance (±)</span><span className="font-mono font-semibold text-brand-700">±{getTolerance()} {form.pressure_unit} (±{form.accuracy_pct_fs}% FS)</span></div>}
                </div>
              )}
            </>
          )}
        </div>

        {/* Calibration schedule */}
        <div className="p-5 space-y-3">
          <h2 className="font-medium text-gray-700 text-sm uppercase tracking-wide">Calibration schedule</h2>
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
          <button onClick={handleSave} disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save instrument'}</button>
          <button onClick={()=>router.back()} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  )
}
