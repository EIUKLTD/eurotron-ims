'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

const ANALYSER_TYPES = ['Fixed Installation','Portable Multi-gas','Flue Gas','Combustion','Emissions','Process Gas']
const empty = { name:'', make:'MRU', model:'', analyser_type:'Fixed Installation', active:true }

export default function ModelsPage() {
  const [models, setModels]     = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing]   = useState<string|null>(null)
  const [form, setForm]         = useState<any>(empty)
  const [saving, setSaving]     = useState(false)
  const supabase = createClient()

  async function load() {
    const { data } = await supabase.from('instrument_models').select('*').order('make').order('model')
    setModels(data||[])
    setLoading(false)
  }

  useEffect(()=>{ load() },[])

  function startNew() { setEditing(null); setForm(empty); setShowForm(true) }

  function startEdit(m:any) {
    setEditing(m.id)
    setForm({ name:m.name||'', make:m.make||'', model:m.model||'', analyser_type:m.analyser_type||'Fixed Installation', active:m.active!==false })
    setShowForm(true); window.scrollTo(0,0)
  }

  async function save() {
    if (!form.make||!form.model) return alert('Make and model are required.')
    setSaving(true)
    if (editing) {
      const { error } = await supabase.from('instrument_models').update(form).eq('id', editing)
      if (error) { alert(error.message); setSaving(false); return }
    } else {
      const { error } = await supabase.from('instrument_models').insert(form)
      if (error) { alert(error.message); setSaving(false); return }
    }
    setSaving(false); setShowForm(false); setEditing(null); setForm(empty); load()
  }

  async function deleteModel(id:string) {
    if (!confirm('Delete this model?')) return
    await supabase.from('instrument_models').delete().eq('id', id); load()
  }

  async function toggleActive(m:any) {
    await supabase.from('instrument_models').update({ active: !m.active }).eq('id', m.id); load()
  }

  function set(k:string,v:any){ setForm((f:any)=>({...f,[k]:v})) }

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Instrument models</h1>
          <p className="text-gray-500 text-sm mt-1">Manage the instrument model dropdown list</p>
        </div>
        <button onClick={startNew} className="btn-primary">+ Add model</button>
      </div>

      {showForm && (
        <div className="card p-5 mb-5">
          <h2 className="font-semibold text-gray-900 mb-4">{editing?'Edit model':'New model'}</h2>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Make *</label><input className="input" value={form.make} onChange={e=>set('make',e.target.value)} placeholder="e.g. MRU" /></div>
            <div><label className="label">Model *</label><input className="input" value={form.model} onChange={e=>set('model',e.target.value)} placeholder="e.g. SWG100 BIOGAS" /></div>
            <div><label className="label">Display name</label><input className="input" value={form.name} onChange={e=>set('name',e.target.value)} placeholder="e.g. SWG100 BIOGAS" /></div>
            <div>
              <label className="label">Analyser type</label>
              <select className="input" value={form.analyser_type} onChange={e=>set('analyser_type',e.target.value)}>
                {ANALYSER_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={save} disabled={saving} className="btn-primary">{saving?'Saving...':editing?'Update model':'Save model'}</button>
            <button onClick={()=>{setShowForm(false);setEditing(null)}} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading...</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase bg-gray-50 text-left">
                <th className="px-5 py-3">Make</th>
                <th className="px-5 py-3">Model</th>
                <th className="px-5 py-3">Analyser type</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {models.map(m=>(
                <tr key={m.id} className={`hover:bg-gray-50 ${m.active===false?'opacity-50':''}`}>
                  <td className="px-5 py-3 font-medium text-gray-900">{m.make}</td>
                  <td className="px-5 py-3 text-gray-700">{m.model}</td>
                  <td className="px-5 py-3 text-gray-500">{m.analyser_type}</td>
                  <td className="px-5 py-3">
                    {m.active!==false?<span className="badge-pass">Active</span>:<span className="badge-gray">Inactive</span>}
                  </td>
                  <td className="px-5 py-3 text-right space-x-3">
                    <button onClick={()=>startEdit(m)} className="text-xs text-brand-500 hover:underline">Edit</button>
                    <button onClick={()=>toggleActive(m)} className="text-xs text-amber-500 hover:underline">{m.active!==false?'Disable':'Enable'}</button>
                    <button onClick={()=>deleteModel(m.id)} className="text-xs text-red-400 hover:underline">Delete</button>
                  </td>
                </tr>
              ))}
              {models.length===0&&(
                <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-400 text-sm">No models yet.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

