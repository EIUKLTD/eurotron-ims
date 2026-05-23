'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

const CATEGORIES = ['Sensors','Pump','Filters','Tubing','Seals','Electronics','Power','Calibration','Admin','Other']
const empty = { description:'', part_number:'', category:'Sensors', notes:'' }

export default function PartsPage() {
  const [parts, setParts]       = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing]   = useState<string|null>(null)
  const [form, setForm]         = useState<any>(empty)
  const [saving, setSaving]     = useState(false)
  const [filter, setFilter]     = useState('')
  const supabase = createClient()

  async function load() {
    const { data } = await supabase.from('parts_library').select('*').order('category').order('description')
    setParts(data||[])
    setLoading(false)
  }

  useEffect(()=>{ load() },[])

  function startEdit(p:any) {
    setEditing(p.id)
    setForm({
      description: p.description||'',
      part_number: p.part_number||'',
      category: p.category||'Sensors',
      notes: p.notes||''
    })
    setShowForm(true)
    window.scrollTo(0,0)
  }

  function startNew() {
    setEditing(null)
    setForm(empty)
    setShowForm(true)
  }

  async function save() {
    if (!form.description) return alert('Description is required.')
    setSaving(true)
    if (editing) {
      const { error } = await supabase.from('parts_library').update(form).eq('id', editing)
      if (error) { alert(error.message); setSaving(false); return }
    } else {
      const { error } = await supabase.from('parts_library').insert({...form, active:true})
      if (error) { alert(error.message); setSaving(false); return }
    }
    setSaving(false)
    setShowForm(false)
    setEditing(null)
    setForm(empty)
    load()
  }

  function cancel() {
    setShowForm(false)
    setEditing(null)
    setForm(empty)
  }

  async function deletePart(id:string) {
    if (!confirm('Delete this part?')) return
    await supabase.from('parts_library').delete().eq('id', id)
    load()
  }

  function set(k:string,v:string){ setForm((f:any)=>({...f,[k]:v})) }

  const filtered = parts.filter(p=>!filter||p.category===filter)
  const grouped = CATEGORIES.reduce((acc,cat)=>{
    const items = filtered.filter(p=>p.category===cat)
    if (items.length) acc[cat]=items
    return acc
  }, {} as Record<string,any[]>)

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Parts library</h1>
          <p className="text-gray-500 text-sm mt-1">{parts.length} parts in catalogue</p>
        </div>
        <button onClick={startNew} className="btn-primary">+ Add part</button>
      </div>

      {showForm && (
        <div className="card p-5 mb-5">
          <h2 className="font-semibold text-gray-900 mb-4">{editing ? 'Edit part' : 'New part'}</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label">Description *</label>
              <input className="input" value={form.description} onChange={e=>set('description',e.target.value)} placeholder="e.g. Electrochemical CO sensor 0-500ppm" />
            </div>
            <div>
              <label className="label">Part number</label>
              <input className="input" value={form.part_number} onChange={e=>set('part_number',e.target.value)} placeholder="e.g. SEN-CO-EC" />
            </div>
            <div>
              <label className="label">Category</label>
              <select className="input" value={form.category} onChange={e=>set('category',e.target.value)}>
                {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="label">Notes</label>
              <input className="input" value={form.notes} onChange={e=>set('notes',e.target.value)} />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={save} disabled={saving} className="btn-primary">
              {saving ? 'Saving...' : editing ? 'Update part' : 'Save part'}
            </button>
            <button onClick={cancel} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={()=>setFilter('')}
          className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${!filter?'bg-brand-500 text-white border-brand-500':'bg-white text-gray-600 border-gray-200 hover:border-brand-300'}`}>
          All
        </button>
        {CATEGORIES.map(c=>(
          <button key={c} onClick={()=>setFilter(c)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${filter===c?'bg-brand-500 text-white border-brand-500':'bg-white text-gray-600 border-gray-200 hover:border-brand-300'}`}>
            {c}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card p-8 text-center text-gray-400 text-sm">Loading...</div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([cat,items])=>(
            <div key={cat} className="card overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
                <span className="font-semibold text-gray-700 text-sm">{cat}</span>
                <span className="text-gray-400 text-xs ml-2">{items.length} items</span>
              </div>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-50">
                  {items.map(p=>(
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3">
                        <div className="font-medium text-gray-900">{p.description}</div>
                        {p.notes&&<div className="text-xs text-gray-400">{p.notes}</div>}
                      </td>
                      <td className="px-5 py-3 text-gray-500 text-xs font-mono">{p.part_number||'—'}</td>
                      <td className="px-5 py-3 text-right space-x-3">
                        <button onClick={()=>startEdit(p)} className="text-xs text-brand-500 hover:underline">Edit</button>
                        <button onClick={()=>deletePart(p.id)} className="text-xs text-red-400 hover:underline">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          {Object.keys(grouped).length===0&&(
            <div className="card p-8 text-center text-gray-400 text-sm">No parts yet. Add your first one!</div>
          )}
        </div>
      )}
    </div>
  )
}