'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

const PRESSURE_UNITS = ['bar','mbar','psi','kPa','MPa','inH2O','mmHg']
const CONNECTIONS = ['1/4" BSP MALE','1/4" BSP FEMALE','1/2" BSP MALE','1/2" BSP FEMALE','1/4" NPT MALE','1/2" NPT MALE','Other']
const GAUGE_TYPES = ['Gauge','Absolute','Differential','Compound']
const ANALYSER_TYPES = ['Flue Gas','Combustion','Emissions','Portable Multi-gas','Fixed Installation','Process Gas']
const CATEGORIES = [
  { key: 'gas_analyser',   label: '🔬 Gas Analyser' },
  { key: 'pressure_gauge', label: '📊 Pressure Gauge' },
  { key: 'temperature',    label: '🌡 Temperature' },
  { key: 'flow',           label: '💧 Flow' },
  { key: 'electrical',     label: '⚡ Electrical' },
  { key: 'other',          label: '🔧 Other' },
]

const emptyForm = {
  instrument_category: 'gas_analyser',
  name: '', make: '', model: '', analyser_type: 'Fixed Installation',
  pressure_range: '', vacuum_range: '', pressure_unit: 'bar',
  accuracy_pct_fs: '0.05', decimal_places: '2',
  gauge_type: 'Gauge', pressure_connection: '1/2" BSP FEMALE',
  active: true,
}

export default function ModelsAdminPage() {
  const [models, setModels]     = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing]   = useState<string|null>(null)
  const [form, setForm]         = useState<any>(emptyForm)
  const [saving, setSaving]     = useState(false)
  const [filter, setFilter]     = useState('all')
  const supabase = createClient()

  async function load() {
    const { data } = await supabase.from('instrument_models').select('*').order('instrument_category').order('make').order('model')
    setModels(data||[]); setLoading(false)
  }

  useEffect(()=>{ load() },[])

  function startNew() { setEditing(null); setForm(emptyForm); setShowForm(true); window.scrollTo(0,0) }

  function startEdit(m:any) {
    setEditing(m.id)
    setForm({
      instrument_category: m.instrument_category || 'gas_analyser',
      name: m.name||'', make: m.make||'', model: m.model||'',
      analyser_type: m.analyser_type||'Fixed Installation',
      pressure_range: m.pressure_range||'', vacuum_range: m.vacuum_range||'',
      pressure_unit: m.pressure_unit||'bar', accuracy_pct_fs: m.accuracy_pct_fs||'0.05',
      decimal_places: m.decimal_places||'2', gauge_type: m.gauge_type||'Gauge',
      pressure_connection: m.pressure_connection||'1/2" BSP FEMALE',
      active: m.active!==false,
    })
    setShowForm(true); window.scrollTo(0,0)
  }

  async function save() {
    if (!form.make || !form.model) return alert('Make and model are required.')
    setSaving(true)
    const payload = {
      ...form,
      pressure_range: form.pressure_range ? parseFloat(form.pressure_range) : null,
      vacuum_range: form.vacuum_range ? parseFloat(form.vacuum_range) : null,
      accuracy_pct_fs: parseFloat(form.accuracy_pct_fs),
      decimal_places: parseInt(form.decimal_places),
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

  const isPressure = form.instrument_category === 'pressure_gauge'
  const isGas = form.instrument_category === 'gas_analyser'

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
            <div><label className="label">Make *</label><input className="input" value={form.make} onChange={e=>set('make',e.target.value)} placeholder="e.g. Wika, Druck, MRU" /></div>
            <div><label className="label">Model *</label><input className="input" value={form.model} onChange={e=>set('model',e.target.value)} placeholder="e.g. EN 837-1, PACE 5000" /></div>
          </div>

          <div className="mb-3">
            <label className="label">Display name (optional)</label>
            <input className="input" value={form.name} onChange={e=>set('name',e.target.value)} placeholder={`${form.make||'Make'} ${form.model||'Model'}`} />
          </div>

          {/* Gas analyser fields */}
          {isGas && (
            <div className="mb-3">
              <label className="label">Analyser type</label>
              <select className="input" value={form.analyser_type} onChange={e=>set('analyser_type',e.target.value)}>
                {ANALYSER_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
              </select>
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
                    {catKey === 'pressure_gauge' && <th className="px-5 py-2 text-left">Range</th>}
                    {catKey === 'pressure_gauge' && <th className="px-5 py-2 text-left">Accuracy</th>}
                    {catKey === 'pressure_gauge' && <th className="px-5 py-2 text-left">Decimals</th>}
                    {catKey === 'gas_analyser' && <th className="px-5 py-2 text-left">Type</th>}
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
                      {catKey === 'pressure_gauge' && (
                        <td className="px-5 py-3 text-xs text-gray-500 font-mono">
                          {m.pressure_range ? `${m.vacuum_range ? m.vacuum_range + ' to ' : '0 to '}${m.pressure_range} ${m.pressure_unit}` : '—'}
                        </td>
                      )}
                      {catKey === 'pressure_gauge' && <td className="px-5 py-3 text-xs text-gray-500">±{m.accuracy_pct_fs}% FS</td>}
                      {catKey === 'pressure_gauge' && <td className="px-5 py-3 text-xs text-gray-500">{m.decimal_places} dp</td>}
                      {catKey === 'gas_analyser' && <td className="px-5 py-3 text-xs text-gray-500">{m.analyser_type||'—'}</td>}
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
