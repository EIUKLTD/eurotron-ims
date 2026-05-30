'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

const GASES = ['O2','CO','CO2','CH4','H2S','NO','NO2','SO2','CxHy','HC','NOx']
const SENSOR_TYPES = ['Electrochemical','NDIR','Pellistor','Catalytic','Thermal Conductivity','Optical','Paramagnetic']
const UNITS = ['ppm','% vol','% LEL','mg/m3','ppb','% v/v']
const empty = { type:'sensor', gas:'O2', name:'', sensor_type:'Electrochemical', range_min:'', range_max:'', unit:'ppm', part_number:'', notes:'', active:true }

export default function SensorLibraryPage() {
  const [items, setItems]       = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing]   = useState<string|null>(null)
  const [form, setForm]         = useState<any>(empty)
  const [saving, setSaving]     = useState(false)
  const [filter, setFilter]     = useState<'all'|'sensor'|'option'>('all')
  const supabase = createClient()

  async function load() {
    const { data } = await supabase.from('sensor_library').select('*').order('type').order('gas').order('name')
    setItems(data||[])
    setLoading(false)
  }

  useEffect(()=>{ load() },[])

  function startNew() { setEditing(null); setForm(empty); setShowForm(true) }

  function startEdit(item:any) {
    setEditing(item.id)
    setForm({
      type: item.type, gas: item.gas||'O2', name: item.name,
      sensor_type: item.sensor_type||'Electrochemical',
      range_min: item.range_min||'', range_max: item.range_max||'',
      unit: item.unit||'ppm', part_number: item.part_number||'',
      notes: item.notes||'', active: item.active!==false
    })
    setShowForm(true); window.scrollTo(0,0)
  }

  async function save() {
    if (!form.name) return alert('Name is required.')
    setSaving(true)
    const payload = {
      ...form,
      range_min: form.range_min ? parseFloat(form.range_min) : null,
      range_max: form.range_max ? parseFloat(form.range_max) : null,
      gas: form.type === 'sensor' ? form.gas : null,
      sensor_type: form.type === 'sensor' ? form.sensor_type : null,
    }
    if (editing) {
      const { error } = await supabase.from('sensor_library').update(payload).eq('id', editing)
      if (error) { alert(error.message); setSaving(false); return }
    } else {
      const { error } = await supabase.from('sensor_library').insert(payload)
      if (error) { alert(error.message); setSaving(false); return }
    }
    setSaving(false); setShowForm(false); setEditing(null); setForm(empty); load()
  }

  async function toggleActive(item:any) {
    await supabase.from('sensor_library').update({ active: !item.active }).eq('id', item.id); load()
  }

  async function deleteItem(id:string) {
    if (!confirm('Delete this item?')) return
    await supabase.from('sensor_library').delete().eq('id', id); load()
  }

  function set(k:string,v:any){ setForm((f:any)=>({...f,[k]:v})) }

  const filtered = items.filter(i => filter === 'all' || i.type === filter)
  const sensors = filtered.filter(i => i.type === 'sensor')
  const options = filtered.filter(i => i.type === 'option')

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Sensor & options library</h1>
          <p className="text-gray-500 text-sm mt-1">Define sensors and options available for instruments</p>
        </div>
        <button onClick={startNew} className="btn-primary">+ Add item</button>
      </div>

      {showForm && (
        <div className="card p-5 mb-5">
          <h2 className="font-semibold text-gray-900 mb-4">{editing?'Edit item':'New item'}</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Type</label>
              <select className="input" value={form.type} onChange={e=>set('type',e.target.value)}>
                <option value="sensor">Sensor</option>
                <option value="option">Option / accessory</option>
              </select>
            </div>
            {form.type === 'sensor' && (
              <div>
                <label className="label">Gas</label>
                <select className="input" value={form.gas} onChange={e=>set('gas',e.target.value)}>
                  {GASES.map(g=><option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            )}
            <div className="col-span-2">
              <label className="label">Name / description *</label>
              <input className="input" value={form.name} onChange={e=>set('name',e.target.value)} placeholder="e.g. H2S Electrochemical 0-2000ppm" />
            </div>
            {form.type === 'sensor' && (
              <>
                <div>
                  <label className="label">Sensor type</label>
                  <select className="input" value={form.sensor_type} onChange={e=>set('sensor_type',e.target.value)}>
                    {SENSOR_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Unit</label>
                  <select className="input" value={form.unit} onChange={e=>set('unit',e.target.value)}>
                    {UNITS.map(u=><option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Range min</label>
                  <input className="input" type="number" value={form.range_min} onChange={e=>set('range_min',e.target.value)} placeholder="e.g. 0" />
                </div>
                <div>
                  <label className="label">Range max</label>
                  <input className="input" type="number" value={form.range_max} onChange={e=>set('range_max',e.target.value)} placeholder="e.g. 2000" />
                </div>
              </>
            )}
            <div>
              <label className="label">Part number</label>
              <input className="input" value={form.part_number} onChange={e=>set('part_number',e.target.value)} placeholder="e.g. SWG100BSPARE-SE-66060" />
            </div>
            <div>
              <label className="label">Notes</label>
              <input className="input" value={form.notes} onChange={e=>set('notes',e.target.value)} />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={save} disabled={saving} className="btn-primary">{saving?'Saving...':editing?'Update':'Save'}</button>
            <button onClick={()=>{setShowForm(false);setEditing(null)}} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-xl p-1 w-fit">
        {[['all','All'],['sensor','Sensors'],['option','Options']].map(([k,l])=>(
          <button key={k} onClick={()=>setFilter(k as any)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter===k?'bg-white shadow text-gray-900':'text-gray-500 hover:text-gray-700'}`}>
            {l}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card p-8 text-center text-gray-400 text-sm">Loading...</div>
      ) : (
        <div className="space-y-4">
          {(filter === 'all' || filter === 'sensor') && sensors.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
                <span className="font-semibold text-gray-700 text-sm">Sensors</span>
                <span className="text-gray-400 text-xs ml-2">{sensors.length} items</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase bg-gray-50">
                    <th className="px-5 py-2 text-left">Gas</th>
                    <th className="px-5 py-2 text-left">Name</th>
                    <th className="px-5 py-2 text-left">Type</th>
                    <th className="px-5 py-2 text-left">Range</th>
                    <th className="px-5 py-2 text-left">Part no.</th>
                    <th className="px-5 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {sensors.map(item=>(
                    <tr key={item.id} className={`hover:bg-gray-50 ${item.active===false?'opacity-50':''}`}>
                      <td className="px-5 py-2"><span className="badge-info">{item.gas}</span></td>
                      <td className="px-5 py-2 font-medium text-gray-900">{item.name}</td>
                      <td className="px-5 py-2 text-gray-500 text-xs">{item.sensor_type}</td>
                      <td className="px-5 py-2 text-gray-500 text-xs font-mono">
                        {item.range_min !== null && item.range_max !== null ? `${item.range_min}-${item.range_max} ${item.unit}` : '—'}
                      </td>
                      <td className="px-5 py-2 text-gray-400 text-xs font-mono">{item.part_number||'—'}</td>
                      <td className="px-5 py-2 text-right space-x-3">
                        <button onClick={()=>startEdit(item)} className="text-xs text-brand-500 hover:underline">Edit</button>
                        <button onClick={()=>toggleActive(item)} className="text-xs text-amber-500 hover:underline">{item.active===false?'Enable':'Disable'}</button>
                        <button onClick={()=>deleteItem(item.id)} className="text-xs text-red-400 hover:underline">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {(filter === 'all' || filter === 'option') && options.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
                <span className="font-semibold text-gray-700 text-sm">Options & accessories</span>
                <span className="text-gray-400 text-xs ml-2">{options.length} items</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase bg-gray-50">
                    <th className="px-5 py-2 text-left">Name</th>
                    <th className="px-5 py-2 text-left">Part no.</th>
                    <th className="px-5 py-2 text-left">Notes</th>
                    <th className="px-5 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {options.map(item=>(
                    <tr key={item.id} className={`hover:bg-gray-50 ${item.active===false?'opacity-50':''}`}>
                      <td className="px-5 py-2 font-medium text-gray-900">{item.name}</td>
                      <td className="px-5 py-2 text-gray-400 text-xs font-mono">{item.part_number||'—'}</td>
                      <td className="px-5 py-2 text-gray-500 text-xs">{item.notes||'—'}</td>
                      <td className="px-5 py-2 text-right space-x-3">
                        <button onClick={()=>startEdit(item)} className="text-xs text-brand-500 hover:underline">Edit</button>
                        <button onClick={()=>toggleActive(item)} className="text-xs text-amber-500 hover:underline">{item.active===false?'Enable':'Disable'}</button>
                        <button onClick={()=>deleteItem(item.id)} className="text-xs text-red-400 hover:underline">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {filtered.length === 0 && (
            <div className="card p-8 text-center text-gray-400 text-sm">
              No items yet. Click "+ Add item" to add your first sensor or option!
            </div>
          )}
        </div>
      )}
    </div>
  )
}
