'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

const PRESSURE_UNITS = ['bar','mbar','psi','kPa','MPa','inH2O','mmHg']
const CONNECTIONS = ['1/4" BSP MALE','1/4" BSP FEMALE','1/2" BSP MALE','1/2" BSP FEMALE','1/4" NPT MALE','1/2" NPT MALE','Other']
const GAUGE_TYPES = ['Gauge','Absolute','Differential','Compound']
const TEMP_INSTRUMENT_TYPES = ['Dry Block', 'Portable Liquid Bath', 'Other']
const TEMP_ACCURACY_TYPES = [
  { key: 'celsius', label: '±°C value' },
  { key: 'pct_fs', label: '% of FS' },
  { key: 'pct_rdg', label: '% of Reading' },
]
const ANALYSER_TYPES = ['Fixed Installation','Portable Multi-gas','Flue Gas','Combustion','Emissions','Process Gas']

// Gases and their default tolerance type
const GAS_OPTIONS = [
  { gas: 'CO2',  unit: '%',   tol: 'pct_bottle', defaultTol: 5 },
  { gas: 'CH4',  unit: '%',   tol: 'pct_bottle', defaultTol: 5 },
  { gas: 'O2',   unit: '%',   tol: 'pct_bottle', defaultTol: 5 },
  { gas: 'CO',   unit: 'ppm', tol: 'fixed',       defaultTol: 5 },
  { gas: 'H2S',  unit: 'ppm', tol: 'fixed',       defaultTol: 5 },
  { gas: 'NO',   unit: 'ppm', tol: 'fixed',       defaultTol: 5 },
  { gas: 'NO2',  unit: 'ppm', tol: 'fixed',       defaultTol: 5 },
  { gas: 'SO2',  unit: 'ppm', tol: 'fixed',       defaultTol: 5 },
  { gas: 'H2',   unit: 'ppm', tol: 'fixed',       defaultTol: 5 },
  { gas: 'CxHy', unit: 'ppm', tol: 'fixed',       defaultTol: 5 },
]

const CATEGORIES = [
  { key: 'gas_analyser',          label: '🔬 Gas Analyser (Fixed)' },
  { key: 'portable_gas_analyser', label: '🔬 Gas Analyser (Portable)' },
  { key: 'pressure_gauge',        label: '📊 Pressure Gauge' },
  { key: 'temperature',           label: '🌡 Temperature' },
  { key: 'flow',                  label: '💧 Flow' },
  { key: 'electrical',            label: '⚡ Electrical' },
  { key: 'other',                 label: '🔧 Other' },
]

const emptyForm = {
  instrument_category: 'gas_analyser',
  name: '', make: '', model: '', analyser_type: 'Fixed Installation',
  gas_sensors: [] as any[],
  pressure_range: '', vacuum_range: '', pressure_unit: 'bar',
  accuracy_pct_fs: '0.05', decimal_places: '2',
  gauge_type: 'Gauge', pressure_connection: '1/2" BSP FEMALE',
  temp_instrument_type: 'Dry Block',
  temp_range_min: '', temp_range_max: '', temp_unit: '°C',
  temp_accuracy_type: 'celsius', temp_accuracy_value: '',
  temp_stability: '', temp_display_resolution: '',
  active: true,
}

export default function ModelsAdminPage() {
  const [models, setModels]     = useState<any[]>([])
  const [makes, setMakes]       = useState<string[]>([])
  const [descriptions, setDescs] = useState<{description:string; category:string}[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing]   = useState<string|null>(null)
  const [form, setForm]         = useState<any>(emptyForm)
  const [saving, setSaving]     = useState(false)
  const [filter, setFilter]     = useState('all')
  const supabase = createClient()

  async function load() {
    const [{ data: m }, { data: mk }, { data: ds }] = await Promise.all([
      supabase.from('instrument_models').select('*').order('instrument_category').order('make').order('model'),
      supabase.from('instrument_makes').select('make').order('make'),
      supabase.from('instrument_descriptions').select('description, category').order('description'),
    ])
    setModels(m||[]); setLoading(false)
    setMakes((mk||[]).map((r:any)=>r.make))
    setDescs(ds||[])
  }

  useEffect(()=>{ load() },[])

  function startNew() { setEditing(null); setForm(emptyForm); setShowForm(true); window.scrollTo(0,0) }

  function startEdit(m:any) {
    setEditing(m.id)
    setForm({
      instrument_category: m.instrument_category || 'gas_analyser',
      name: m.name||'', make: m.make||'', model: m.model||'',
      analyser_type: m.analyser_type||'Fixed Installation',
      gas_sensors: m.gas_sensors || [],
      pressure_range: m.pressure_range||'', vacuum_range: m.vacuum_range||'',
      pressure_unit: m.pressure_unit||'bar', accuracy_pct_fs: m.accuracy_pct_fs||'0.05',
      decimal_places: m.decimal_places||'2', gauge_type: m.gauge_type||'Gauge',
      pressure_connection: m.pressure_connection||'1/2" BSP FEMALE',
      temp_instrument_type: m.temp_instrument_type||'Dry Block',
      temp_range_min: m.temp_range_min||'', temp_range_max: m.temp_range_max||'',
      temp_unit: m.temp_unit||'°C', temp_accuracy_type: m.temp_accuracy_type||'celsius',
      temp_accuracy_value: m.temp_accuracy_value||'', temp_stability: m.temp_stability||'',
      temp_display_resolution: m.temp_display_resolution||'',
      active: m.active!==false,
    })
    setShowForm(true); window.scrollTo(0,0)
  }

  async function save() {
    if (!form.make || !form.model) return alert('Make and model are required.')
    setSaving(true)
    const payload = {
      ...form,
      gas_sensors: form.gas_sensors || [],
      pressure_range: form.pressure_range ? parseFloat(form.pressure_range) : null,
      vacuum_range: form.vacuum_range ? parseFloat(form.vacuum_range) : null,
      accuracy_pct_fs: parseFloat(form.accuracy_pct_fs),
      decimal_places: parseInt(form.decimal_places),
      temp_instrument_type: form.temp_instrument_type || null,
      temp_range_min: form.temp_range_min ? parseFloat(form.temp_range_min) : null,
      temp_range_max: form.temp_range_max ? parseFloat(form.temp_range_max) : null,
      temp_unit: form.temp_unit || '°C',
      temp_accuracy_type: form.temp_accuracy_type || null,
      temp_accuracy_value: form.temp_accuracy_value ? parseFloat(form.temp_accuracy_value) : null,
      temp_stability: form.temp_stability ? parseFloat(form.temp_stability) : null,
      temp_display_resolution: form.temp_display_resolution ? parseFloat(form.temp_display_resolution) : null,
      name: form.name || `${form.make} ${form.model}`,
    }
    if (editing) {
      await supabase.from('instrument_models').update(payload).eq('id', editing)
    } else {
      await supabase.from('instrument_models').insert(payload)
    }
    setSaving(false); setShowForm(false); setEditing(null); setForm(emptyForm); load()
  }

  async function toggleActive(m:any) {
    await supabase.from('instrument_models').update({ active: !m.active }).eq('id', m.id); load()
  }

  async function deleteModel(id:string) {
    if (!confirm('Delete this model?')) return
    await supabase.from('instrument_models').delete().eq('id', id); load()
  }

  function set(k:string, v:any) { setForm((f:any)=>({...f,[k]:v})) }

  // Gas sensor management
  function addGasSensor() {
    const defaults = GAS_OPTIONS[0]
    const newSensor = { gas: defaults.gas, unit: defaults.unit, nominal: '', tolerance_type: defaults.tol, tolerance_value: defaults.defaultTol }
    setForm((f:any) => ({ ...f, gas_sensors: [...(f.gas_sensors||[]), newSensor] }))
  }

  function updateSensor(idx: number, field: string, value: any) {
    setForm((f:any) => {
      const sensors = [...(f.gas_sensors||[])]
      sensors[idx] = { ...sensors[idx], [field]: value }
      // If gas changed, update unit and default tolerance type
      if (field === 'gas') {
        const opt = GAS_OPTIONS.find(g => g.gas === value)
        if (opt) {
          sensors[idx].unit = opt.unit
          sensors[idx].tolerance_type = opt.tol
          sensors[idx].tolerance_value = opt.defaultTol
        }
      }
      return { ...f, gas_sensors: sensors }
    })
  }

  function removeSensor(idx: number) {
    setForm((f:any) => ({ ...f, gas_sensors: f.gas_sensors.filter((_:any, i:number) => i !== idx) }))
  }

  const isPressure = form.instrument_category === 'pressure_gauge'
  const isTemperature = form.instrument_category === 'temperature'
  const isGas = form.instrument_category === 'gas_analyser' || form.instrument_category === 'portable_gas_analyser'

  const filtered = models.filter(m => filter === 'all' || m.instrument_category === filter)
  const grouped = CATEGORIES.reduce((acc, cat) => {
    const items = filtered.filter(m => (m.instrument_category || 'gas_analyser') === cat.key)
    if (items.length) acc[cat.key] = { label: cat.label, items }
    return acc
  }, {} as Record<string, any>)

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Instrument models</h1>
          <p className="text-gray-500 text-sm mt-1">Manage models for all instrument types</p>
        </div>
        <button onClick={startNew} className="btn-primary">+ Add model</button>
      </div>

      {showForm && (
        <div className="card p-5 mb-5">
          <h2 className="font-semibold text-gray-900 mb-4">{editing?'Edit model':'New model'}</h2>

          {/* Category */}
          <div className="mb-4">
            <label className="label">Category</label>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map(cat => (
                <button key={cat.key} onClick={() => set('instrument_category', cat.key)}
                  className={`py-2 px-3 rounded-xl border-2 text-xs font-medium text-left transition-colors ${form.instrument_category === cat.key ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 bg-white text-gray-500'}`}>
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            {/* Make - dropdown from instrument_makes */}
            <div>
              <label className="label">Make *</label>
              <select className="input" value={form.make} onChange={e=>set('make',e.target.value)}>
                <option value="">— select —</option>
                {makes.map(mk=><option key={mk} value={mk}>{mk}</option>)}
                <option value="__other__">Other (type below)</option>
              </select>
              {(form.make === '__other__' || (form.make && !makes.includes(form.make))) && (
                <input className="input mt-2" value={form.make === '__other__' ? '' : form.make}
                  onChange={e=>set('make',e.target.value)} placeholder="Type make name..." />
              )}
            </div>
            <div><label className="label">Model number *</label><input className="input" value={form.model} onChange={e=>set('model',e.target.value)} placeholder="e.g. EN 837-1, PACE 5000" /></div>
          </div>

          {/* Description - dropdown from instrument_descriptions, filters by category */}
          <div className="mb-3">
            <label className="label">Description (optional)</label>
            <select className="input" value={form.name} onChange={e=>set('name',e.target.value)}>
              <option value="">— select or leave blank —</option>
              {descriptions
                .filter(d => !d.category || d.category === form.instrument_category)
                .map(d=><option key={d.description} value={d.description}>{d.description}</option>)}
            </select>
          </div>

          {/* Gas analyser fields */}
          {isGas && (
            <div className="space-y-4">
              <div>
                <label className="label">Analyser type</label>
                <select className="input" value={form.analyser_type} onChange={e=>set('analyser_type',e.target.value)}>
                  {ANALYSER_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              {/* Gas sensor configuration */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="label mb-0">Gas sensor configuration</label>
                  <button onClick={addGasSensor} className="text-xs text-brand-500 hover:underline">+ Add gas</button>
                </div>
                {(form.gas_sensors||[]).length === 0 ? (
                  <div className="text-xs text-gray-400 bg-gray-50 rounded-xl p-3 text-center">
                    No gases configured. Click "+ Add gas" to define which gases this analyser measures.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Header */}
                    <div className="grid grid-cols-12 gap-2 text-xs text-gray-400 font-medium px-1">
                      <div className="col-span-2">Gas</div>
                      <div className="col-span-2">Unit</div>
                      <div className="col-span-3">Nominal (bottle)</div>
                      <div className="col-span-3">Tolerance type</div>
                      <div className="col-span-1">Tol. value</div>
                      <div className="col-span-1"></div>
                    </div>
                    {(form.gas_sensors||[]).map((sensor:any, idx:number) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-gray-50 rounded-xl p-2">
                        <div className="col-span-2">
                          <select className="input text-xs py-1" value={sensor.gas} onChange={e=>updateSensor(idx,'gas',e.target.value)}>
                            {GAS_OPTIONS.map(g=><option key={g.gas} value={g.gas}>{g.gas}</option>)}
                          </select>
                        </div>
                        <div className="col-span-2">
                          <input className="input text-xs py-1" value={sensor.unit} onChange={e=>updateSensor(idx,'unit',e.target.value)} placeholder="%" />
                        </div>
                        <div className="col-span-3">
                          <input className="input text-xs py-1" type="number" step="any" value={sensor.nominal||''} onChange={e=>updateSensor(idx,'nominal',e.target.value)} placeholder="e.g. 20" />
                        </div>
                        <div className="col-span-3">
                          <select className="input text-xs py-1" value={sensor.tolerance_type} onChange={e=>updateSensor(idx,'tolerance_type',e.target.value)}>
                            <option value="fixed">Fixed (±X {sensor.unit})</option>
                            <option value="pct_bottle">% of bottle value</option>
                          </select>
                        </div>
                        <div className="col-span-1">
                          <input className="input text-xs py-1" type="number" step="any" value={sensor.tolerance_value||''} onChange={e=>updateSensor(idx,'tolerance_value',e.target.value)} placeholder="5" />
                        </div>
                        <div className="col-span-1 flex justify-end">
                          <button onClick={()=>removeSensor(idx)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                        </div>
                      </div>
                    ))}
                    <p className="text-xs text-gray-400 px-1">
                      Tip: CO2, CH4, O2 → use "% of bottle value". CO, NO, NO2, SO2, H2S → use "Fixed".
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Pressure gauge fields */}
          {isPressure && (
            <div className="space-y-3">
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
                <div><label className="label">Default pressure range</label><input className="input" type="number" step="any" value={form.pressure_range} onChange={e=>set('pressure_range',e.target.value)} placeholder="e.g. 20" /></div>
                <div><label className="label">Default vacuum range</label><input className="input" type="number" step="any" value={form.vacuum_range} onChange={e=>set('vacuum_range',e.target.value)} placeholder="e.g. -1" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Default accuracy (%FS)</label><input className="input" type="number" step="0.001" value={form.accuracy_pct_fs} onChange={e=>set('accuracy_pct_fs',e.target.value)} /></div>
                <div>
                  <label className="label">Default decimal places</label>
                  <select className="input" value={form.decimal_places} onChange={e=>set('decimal_places',e.target.value)}>
                    {[1,2,3,4,5].map(n=><option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Default connection</label>
                <select className="input" value={form.pressure_connection} onChange={e=>set('pressure_connection',e.target.value)}>
                  {CONNECTIONS.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {form.pressure_range && (
                <div className="bg-brand-50 rounded-xl p-3 text-xs space-y-1">
                  <div className="flex justify-between"><span className="text-gray-500">Resolution</span><span className="font-mono font-semibold text-brand-700">{Math.pow(10,-parseInt(form.decimal_places)).toFixed(parseInt(form.decimal_places))} {form.pressure_unit}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Tolerance (±)</span><span className="font-mono font-semibold text-brand-700">±{(parseFloat(form.accuracy_pct_fs)*parseFloat(form.pressure_range)/100).toFixed(parseInt(form.decimal_places))} {form.pressure_unit}</span></div>
                </div>
              )}
            </div>
          )}

          {/* Temperature fields */}
          {isTemperature && (
            <div className="space-y-3">
              <div>
                <label className="label">Temperature instrument type</label>
                <select className="input" value={form.temp_instrument_type} onChange={e=>set('temp_instrument_type',e.target.value)}>
                  {TEMP_INSTRUMENT_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Range min (°C)</label><input className="input" type="number" step="any" value={form.temp_range_min} onChange={e=>set('temp_range_min',e.target.value)} placeholder="e.g. -25" /></div>
                <div><label className="label">Range max (°C)</label><input className="input" type="number" step="any" value={form.temp_range_max} onChange={e=>set('temp_range_max',e.target.value)} placeholder="e.g. 650" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Accuracy type</label>
                  <select className="input" value={form.temp_accuracy_type} onChange={e=>set('temp_accuracy_type',e.target.value)}>
                    {TEMP_ACCURACY_TYPES.map(t=><option key={t.key} value={t.key}>{t.label}</option>)}
                  </select>
                </div>
                <div><label className="label">Accuracy value</label><input className="input" type="number" step="any" value={form.temp_accuracy_value} onChange={e=>set('temp_accuracy_value',e.target.value)} placeholder="e.g. 0.5" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Stability (°C)</label><input className="input" type="number" step="any" value={form.temp_stability} onChange={e=>set('temp_stability',e.target.value)} placeholder="e.g. 0.05" /></div>
                <div><label className="label">Display resolution (°C)</label><input className="input" type="number" step="any" value={form.temp_display_resolution} onChange={e=>set('temp_display_resolution',e.target.value)} placeholder="e.g. 0.1" /></div>
              </div>
            </div>
          )}

          <div className="flex gap-3 mt-4">
            <button onClick={save} disabled={saving} className="btn-primary">{saving?'Saving...':editing?'Update':'Save'}</button>
            <button onClick={()=>{setShowForm(false);setEditing(null)}} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-xl p-1 w-fit overflow-x-auto">
        <button onClick={()=>setFilter('all')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter==='all'?'bg-white shadow text-gray-900':'text-gray-500'}`}>All ({models.length})</button>
        {CATEGORIES.map(cat => {
          const count = models.filter(m=>(m.instrument_category||'gas_analyser')===cat.key).length
          if (!count) return null
          return (
            <button key={cat.key} onClick={()=>setFilter(cat.key)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${filter===cat.key?'bg-white shadow text-gray-900':'text-gray-500'}`}>
              {cat.label} ({count})
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="card p-8 text-center text-gray-400 text-sm">Loading...</div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([catKey, group]: [string, any]) => (
            <div key={catKey} className="card overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
                <span className="font-semibold text-gray-700 text-sm">{group.label}</span>
                <span className="text-gray-400 text-xs ml-2">{group.items.length} models</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase bg-gray-50">
                    <th className="px-5 py-2 text-left">Make / Model</th>
                    {(catKey === 'gas_analyser' || catKey === 'portable_gas_analyser') && <th className="px-5 py-2 text-left">Type</th>}
                    {(catKey === 'gas_analyser' || catKey === 'portable_gas_analyser') && <th className="px-5 py-2 text-left">Gases</th>}
                    {catKey === 'pressure_gauge' && <th className="px-5 py-2 text-left">Range</th>}
                    {catKey === 'pressure_gauge' && <th className="px-5 py-2 text-left">Accuracy</th>}
                    {catKey === 'pressure_gauge' && <th className="px-5 py-2 text-left">Decimals</th>}
                    {catKey === 'temperature' && <th className="px-5 py-2 text-left">Type</th>}
                    {catKey === 'temperature' && <th className="px-5 py-2 text-left">Range</th>}
                    {catKey === 'temperature' && <th className="px-5 py-2 text-left">Accuracy</th>}
                    {catKey === 'temperature' && <th className="px-5 py-2 text-left">Stability</th>}
                    <th className="px-5 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {group.items.map((m:any) => (
                    <tr key={m.id} className={`hover:bg-gray-50 ${m.active===false?'opacity-50':''}`}>
                      <td className="px-5 py-3">
                        <div className="font-medium text-gray-900">{m.make} {m.model}</div>
                        {m.name && m.name !== `${m.make} ${m.model}` && <div className="text-xs text-gray-400">{m.name}</div>}
                      </td>
                      {(catKey === 'gas_analyser' || catKey === 'portable_gas_analyser') && (
                        <td className="px-5 py-3 text-xs text-gray-500">{m.analyser_type||'—'}</td>
                      )}
                      {(catKey === 'gas_analyser' || catKey === 'portable_gas_analyser') && (
                        <td className="px-5 py-3 text-xs text-gray-500">
                          {(m.gas_sensors||[]).length > 0
                            ? (m.gas_sensors||[]).map((s:any)=>s.gas).join(', ')
                            : <span className="text-gray-300">—</span>}
                        </td>
                      )}
                      {catKey === 'pressure_gauge' && (
                        <td className="px-5 py-3 text-xs text-gray-500 font-mono">
                          {m.pressure_range ? `${m.vacuum_range ? m.vacuum_range + ' to ' : '0 to '}${m.pressure_range} ${m.pressure_unit}` : '—'}
                        </td>
                      )}
                      {catKey === 'pressure_gauge' && <td className="px-5 py-3 text-xs text-gray-500">±{m.accuracy_pct_fs}% FS</td>}
                      {catKey === 'pressure_gauge' && <td className="px-5 py-3 text-xs text-gray-500">{m.decimal_places} dp</td>}
                      {catKey === 'temperature' && <td className="px-5 py-3 text-xs text-gray-500">{m.temp_instrument_type||'—'}</td>}
                      {catKey === 'temperature' && <td className="px-5 py-3 text-xs text-gray-500 font-mono">{m.temp_range_min !== null ? `${m.temp_range_min} to ${m.temp_range_max} °C` : '—'}</td>}
                      {catKey === 'temperature' && <td className="px-5 py-3 text-xs text-gray-500">{m.temp_accuracy_value ? `±${m.temp_accuracy_value}${m.temp_accuracy_type === 'celsius' ? '°C' : m.temp_accuracy_type === 'pct_fs' ? '% FS' : '% RDG'}` : '—'}</td>}
                      {catKey === 'temperature' && <td className="px-5 py-3 text-xs text-gray-500">{m.temp_stability ? `±${m.temp_stability}°C` : '—'}</td>}
                      <td className="px-5 py-3 text-right space-x-3">
                        <button onClick={()=>startEdit(m)} className="text-xs text-brand-500 hover:underline">Edit</button>
                        <button onClick={()=>toggleActive(m)} className="text-xs text-amber-500 hover:underline">{m.active===false?'Enable':'Disable'}</button>
                        <button onClick={()=>deleteModel(m.id)} className="text-xs text-red-400 hover:underline">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          {Object.keys(grouped).length === 0 && (
            <div className="card p-8 text-center text-gray-400 text-sm">No models yet — click "+ Add model" to get started!</div>
          )}
        </div>
      )}
    </div>
  )
}
