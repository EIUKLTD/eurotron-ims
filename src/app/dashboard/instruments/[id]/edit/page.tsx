'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

const CATEGORIES = [
  { key: 'gas_analyser',   label: '🔬 Gas Analyser' },
  { key: 'pressure_gauge', label: '📊 Pressure Gauge' },
  { key: 'temperature',    label: '🌡 Temperature' },
  { key: 'flow',           label: '💧 Flow' },
  { key: 'electrical',     label: '⚡ Electrical' },
  { key: 'other',          label: '🔧 Other' },
]

const GAS_OPTIONS = ['CO','CO2','O2','NO','NO2','SO2','H2S','CH4','CxHy','HC','NOx']
const ANALYSER_TYPES = ['Flue Gas','Combustion','Emissions','Portable Multi-gas','Fixed Installation','Process Gas']
const PRESSURE_UNITS = ['bar','mbar','psi','kPa','MPa','inH2O','mmHg']
const CONNECTIONS = ['1/4" BSP MALE','1/4" BSP FEMALE','1/2" BSP MALE','1/2" BSP FEMALE','1/4" NPT MALE','1/2" NPT MALE','Other']
const GAUGE_TYPES = ['Gauge','Absolute','Differential','Compound']
const TEMP_TYPES = ['Dry Block','Portable Liquid Bath','Other']
const TEMP_ACC_TYPES = [
  { key: 'celsius', label: '±°C value' },
  { key: 'pct_fs',  label: '% of FS' },
  { key: 'pct_rdg', label: '% of Reading' },
]
const INSTRUMENT_TYPES: Record<string, string[]> = {
  gas_analyser:   ['Fixed Gas Analyser','Portable Gas Analyser','Flue Gas Analyser','Process Gas Analyser'],
  pressure_gauge: ['Digital Pressure Gauge','Analogue Pressure Gauge','Digital Compound Gauge','Analogue Compound Gauge','Differential Pressure Gauge'],
  temperature:    ['Dry Block Calibrator','Portable Liquid Bath','Temperature Calibrator'],
  flow:           ['Flow Meter','Mass Flow Controller','Ultrasonic Flow Meter'],
  electrical:     ['Multimeter','Clamp Meter','Insulation Tester','PAT Tester'],
  other:          ['Other Instrument'],
}

export default function EditInstrumentPage() {
  const router   = useRouter()
  const params   = useParams()
  const id       = params.id as string
  const supabase = createClient()

  const [customers, setCustomers]         = useState<any[]>([])
  const [sites, setSites]                 = useState<any[]>([])
  const [filteredSites, setFilteredSites] = useState<any[]>([])
  const [saving, setSaving]               = useState(false)
  const [loading, setLoading]             = useState(true)
  const [form, setForm]                   = useState<any>(null)

  useEffect(() => {
    Promise.all([
      supabase.from('customers').select('id,name').order('name'),
      supabase.from('sites').select('*').order('name'),
      supabase.from('instruments').select('*').eq('id', id).single(),
    ]).then(([{ data: c }, { data: s }, { data: inst }]) => {
      setCustomers(c||[]); setSites(s||[])
      if (inst) {
        setForm({
          instrument_category: inst.instrument_category || 'gas_analyser',
          name: inst.name || '',
          make: inst.make || '',
          model: inst.model || '',
          serial_number: inst.serial_number || '',
          asset_tag: inst.asset_tag || '',
          firmware_version: inst.firmware_version || '',
          analyser_type: inst.analyser_type || 'Fixed Installation',
          gases_measured: inst.gases_measured || [],
          customer_id: inst.customer_id || '',
          site_id: inst.site_id || '',
          location: inst.location || '',
          // Pressure
          pressure_range: inst.pressure_range || '',
          vacuum_range: inst.vacuum_range || '',
          pressure_unit: inst.pressure_unit || 'bar',
          accuracy_pct_fs: inst.accuracy_pct_fs || '0.05',
          decimal_places: inst.decimal_places || 2,
          gauge_type: inst.gauge_type || 'Gauge',
          pressure_connection: inst.pressure_connection || '1/2" BSP FEMALE',
          // Temperature
          temp_instrument_type: inst.temp_instrument_type || 'Dry Block',
          temp_range_min: inst.temp_range_min || '',
          temp_range_max: inst.temp_range_max || '',
          temp_unit: inst.temp_unit || '°C',
          temp_accuracy_type: inst.temp_accuracy_type || 'celsius',
          temp_accuracy_value: inst.temp_accuracy_value || '',
          temp_stability: inst.temp_stability || '',
          temp_display_resolution: inst.temp_display_resolution || '',
          // Schedule
          cal_interval_months: inst.cal_interval_months || 12,
          last_cal_date: inst.last_cal_date || '',
          next_cal_date: inst.next_cal_date || '',
          purchase_date: inst.purchase_date || '',
          warranty_expiry: inst.warranty_expiry || '',
          notes: inst.notes || '',
          status: inst.status || 'active',
        })
        setFilteredSites((s||[]).filter((site: any) => site.customer_id === inst.customer_id))
      }
      setLoading(false)
    })
  }, [id])

  function set(k: string, v: any) { setForm((f: any) => ({ ...f, [k]: v })) }

  function handleCustomerChange(customerId: string) {
    set('customer_id', customerId); set('site_id', '')
    setFilteredSites(sites.filter(s => s.customer_id === customerId))
  }

  function handleSiteChange(siteId: string) {
    set('site_id', siteId)
    const site = sites.find(s => s.id === siteId)
    if (site) set('location', [site.name, site.address, site.city, site.postcode].filter(Boolean).join(', '))
  }

  function toggleGas(g: string) {
    set('gases_measured', form.gases_measured.includes(g)
      ? form.gases_measured.filter((x: string) => x !== g)
      : [...form.gases_measured, g])
  }

  async function handleSave() {
    if (!form.customer_id) return alert('Please select a customer.')
    if (!form.name) return alert('Please select an instrument type.')
    setSaving(true)
    const { error } = await supabase.from('instruments').update({
      instrument_category: form.instrument_category,
      name: form.name, make: form.make, model: form.model,
      serial_number: form.serial_number || null,
      asset_tag: form.asset_tag || null,
      firmware_version: form.firmware_version || null,
      analyser_type: form.analyser_type || null,
      gases_measured: form.gases_measured.length ? form.gases_measured : null,
      customer_id: form.customer_id,
      site_id: form.site_id || null,
      location: form.location || null,
      cal_interval_months: Number(form.cal_interval_months),
      last_cal_date:   form.last_cal_date   || null,
      next_cal_date:   form.next_cal_date   || null,
      purchase_date:   form.purchase_date   || null,
      warranty_expiry: form.warranty_expiry || null,
      notes: form.notes || null,
      status: form.status,
      pressure_range:      form.pressure_range ? parseFloat(form.pressure_range) : null,
      vacuum_range:        form.vacuum_range   ? parseFloat(form.vacuum_range)   : null,
      pressure_unit:       form.pressure_unit,
      accuracy_pct_fs:     parseFloat(form.accuracy_pct_fs) || null,
      decimal_places:      parseInt(form.decimal_places) || null,
      gauge_type:          form.gauge_type || null,
      pressure_connection: form.pressure_connection || null,
      temp_instrument_type:    form.temp_instrument_type || null,
      temp_range_min:          form.temp_range_min ? parseFloat(form.temp_range_min) : null,
      temp_range_max:          form.temp_range_max ? parseFloat(form.temp_range_max) : null,
      temp_unit:               form.temp_unit || null,
      temp_accuracy_type:      form.temp_accuracy_type || null,
      temp_accuracy_value:     form.temp_accuracy_value ? parseFloat(form.temp_accuracy_value) : null,
      temp_stability:          form.temp_stability ? parseFloat(form.temp_stability) : null,
      temp_display_resolution: form.temp_display_resolution ? parseFloat(form.temp_display_resolution) : null,
    }).eq('id', id)
    setSaving(false)
    if (error) { alert(error.message); return }
    router.push(`/dashboard/instruments/${id}`)
  }

  if (loading || !form) return <div className="p-6 text-gray-400">Loading...</div>

  const cat = form.instrument_category
  const isPressure = cat === 'pressure_gauge'
  const isTemp     = cat === 'temperature'
  const isGas      = cat === 'gas_analyser'

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <div className="text-xs text-gray-400 mb-1">
          <a href="/dashboard/instruments" className="hover:text-brand-500">Instruments</a> / Edit
        </div>
        <h1 className="text-2xl font-semibold text-gray-900">Edit instrument</h1>
      </div>

      <div className="card divide-y divide-gray-100">

        {/* Category */}
        <div className="p-5 space-y-3">
          <h2 className="font-medium text-gray-700 text-sm uppercase tracking-wide">Instrument category</h2>
          <div className="grid grid-cols-3 gap-2">
            {CATEGORIES.map(c => (
              <button key={c.key} onClick={() => set('instrument_category', c.key)}
                className={`py-2.5 px-3 rounded-xl border-2 text-xs font-medium text-left transition-colors ${cat === c.key ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'}`}>
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Customer & Site */}
        <div className="p-5 space-y-3">
          <h2 className="font-medium text-gray-700 text-sm uppercase tracking-wide">Customer & site</h2>
          <div>
            <label className="label">Customer *</label>
            <select className="input" value={form.customer_id} onChange={e => handleCustomerChange(e.target.value)}>
              <option value="">Select customer...</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Site</label>
            <select className="input" value={form.site_id} onChange={e => handleSiteChange(e.target.value)} disabled={!form.customer_id}>
              <option value="">{form.customer_id ? 'Select site...' : 'Select a customer first'}</option>
              {filteredSites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>

        {/* Instrument details */}
        <div className="p-5 space-y-3">
          <h2 className="font-medium text-gray-700 text-sm uppercase tracking-wide">Instrument details</h2>

          <div>
            <label className="label">Instrument type *</label>
            <select className="input" value={form.name} onChange={e => set('name', e.target.value)}>
              <option value="">Select type...</option>
              {(INSTRUMENT_TYPES[cat] || INSTRUMENT_TYPES.other).map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Make</label><input className="input" value={form.make} onChange={e => set('make', e.target.value)} /></div>
            <div><label className="label">Model</label><input className="input" value={form.model} onChange={e => set('model', e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Serial number</label><input className="input" value={form.serial_number} onChange={e => set('serial_number', e.target.value)} /></div>
            <div><label className="label">Asset / tag ID</label><input className="input" value={form.asset_tag} onChange={e => set('asset_tag', e.target.value)} /></div>
          </div>

          {/* Gas analyser specific */}
          {isGas && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Firmware version</label><input className="input" value={form.firmware_version} onChange={e => set('firmware_version', e.target.value)} /></div>
                <div>
                  <label className="label">Analyser type</label>
                  <select className="input" value={form.analyser_type} onChange={e => set('analyser_type', e.target.value)}>
                    {ANALYSER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="label mb-2">Gases measured</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {GAS_OPTIONS.map(g => (
                    <button key={g} type="button" onClick={() => toggleGas(g)}
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
                  <select className="input" value={form.pressure_unit} onChange={e => set('pressure_unit', e.target.value)}>
                    {PRESSURE_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Gauge type</label>
                  <select className="input" value={form.gauge_type} onChange={e => set('gauge_type', e.target.value)}>
                    {GAUGE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Pressure range ({form.pressure_unit})</label><input className="input" type="number" step="any" value={form.pressure_range} onChange={e => set('pressure_range', e.target.value)} /></div>
                <div><label className="label">Vacuum range ({form.pressure_unit})</label><input className="input" type="number" step="any" value={form.vacuum_range} onChange={e => set('vacuum_range', e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Accuracy (%FS)</label><input className="input" type="number" step="0.001" value={form.accuracy_pct_fs} onChange={e => set('accuracy_pct_fs', e.target.value)} /></div>
                <div>
                  <label className="label">Decimal places</label>
                  <select className="input" value={form.decimal_places} onChange={e => set('decimal_places', parseInt(e.target.value))}>
                    {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} dp</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Pressure connection</label>
                <select className="input" value={form.pressure_connection} onChange={e => set('pressure_connection', e.target.value)}>
                  {CONNECTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </>
          )}

          {/* Temperature specific */}
          {isTemp && (
            <>
              <div>
                <label className="label">Instrument type</label>
                <select className="input" value={form.temp_instrument_type} onChange={e => set('temp_instrument_type', e.target.value)}>
                  {TEMP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Range min (°C)</label><input className="input" type="number" step="any" value={form.temp_range_min} onChange={e => set('temp_range_min', e.target.value)} /></div>
                <div><label className="label">Range max (°C)</label><input className="input" type="number" step="any" value={form.temp_range_max} onChange={e => set('temp_range_max', e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Accuracy type</label>
                  <select className="input" value={form.temp_accuracy_type} onChange={e => set('temp_accuracy_type', e.target.value)}>
                    {TEMP_ACC_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Accuracy value</label>
                  <input className="input" type="number" step="any" value={form.temp_accuracy_value} onChange={e => set('temp_accuracy_value', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Stability (°C)</label><input className="input" type="number" step="any" value={form.temp_stability} onChange={e => set('temp_stability', e.target.value)} /></div>
                <div><label className="label">Display resolution (°C)</label><input className="input" type="number" step="any" value={form.temp_display_resolution} onChange={e => set('temp_display_resolution', e.target.value)} /></div>
              </div>
            </>
          )}
        </div>

        {/* Calibration schedule */}
        <div className="p-5 space-y-3">
          <h2 className="font-medium text-gray-700 text-sm uppercase tracking-wide">Calibration schedule</h2>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="label">Interval (months)</label><input className="input" type="number" value={form.cal_interval_months} onChange={e => set('cal_interval_months', e.target.value)} min={1} /></div>
            <div><label className="label">Last calibration</label><input className="input" type="date" value={form.last_cal_date} onChange={e => set('last_cal_date', e.target.value)} /></div>
            <div><label className="label">Next cal due</label><input className="input" type="date" value={form.next_cal_date} onChange={e => set('next_cal_date', e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Purchase date</label><input className="input" type="date" value={form.purchase_date} onChange={e => set('purchase_date', e.target.value)} /></div>
            <div><label className="label">Warranty expiry</label><input className="input" type="date" value={form.warranty_expiry} onChange={e => set('warranty_expiry', e.target.value)} /></div>
          </div>
        </div>

        {/* Notes & status */}
        <div className="p-5 space-y-3">
          <div><label className="label">Notes</label><textarea className="input" rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} /></div>
          <div>
            <label className="label">Status</label>
            <select className="input max-w-xs" value={form.status} onChange={e => set('status', e.target.value)}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="on_loan">On loan</option>
              <option value="scrapped">Scrapped</option>
            </select>
          </div>
        </div>

        <div className="p-5 flex gap-3">
          <button onClick={handleSave} disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save changes'}</button>
          <button onClick={() => router.back()} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  )
}
