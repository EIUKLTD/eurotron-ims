'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

interface ChecklistItem {
  id: string
  category: string
  item: string
  required: boolean
}

const CATEGORIES = ['Sample System', 'Sensors', 'Electrical', 'Alarms', 'Calibration', 'Handover', 'General']

export default function CommissioningTemplatesPage() {
  const [templates, setTemplates] = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [editing, setEditing]     = useState<string|null>(null)
  const [name, setName]           = useState('')
  const [description, setDescription] = useState('')
  const [items, setItems]         = useState<ChecklistItem[]>([])
  const [saving, setSaving]       = useState(false)
  const supabase = createClient()

  async function load() {
    const { data } = await supabase.from('commissioning_templates').select('*').order('name')
    setTemplates(data||[])
    setLoading(false)
  }

  useEffect(()=>{ load() },[])

  function startNew() {
    setEditing(null); setName(''); setDescription(''); setItems([]); setShowForm(true)
  }

  function startEdit(t:any) {
    setEditing(t.id); setName(t.name||''); setDescription(t.description||'')
    setItems(t.items||[]); setShowForm(true); window.scrollTo(0,0)
  }

  function addItem() {
    setItems(i=>[...i, { id: Math.random().toString(36).slice(2), category:'General', item:'', required:false }])
  }

  function removeItem(id:string) { setItems(i=>i.filter(x=>x.id!==id)) }

  function updateItem(id:string, key:string, val:any) {
    setItems(i=>i.map(x=>x.id===id?{...x,[key]:val}:x))
  }

  async function save() {
    if (!name) return alert('Template name is required.')
    if (!items.length) return alert('Add at least one checklist item.')
    setSaving(true)
    const payload = { name, description, items, active: true }
    if (editing) {
      await supabase.from('commissioning_templates').update(payload).eq('id', editing)
    } else {
      await supabase.from('commissioning_templates').insert(payload)
    }
    setSaving(false); setShowForm(false); setEditing(null); load()
  }

  async function deleteTemplate(id:string) {
    if (!confirm('Delete this template?')) return
    await supabase.from('commissioning_templates').delete().eq('id', id); load()
  }

  const groupedItems = (tmplItems: ChecklistItem[]) => {
    const groups: Record<string, ChecklistItem[]> = {}
    tmplItems.forEach(item => {
      if (!groups[item.category]) groups[item.category] = []
      groups[item.category].push(item)
    })
    return groups
  }

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Commissioning templates</h1>
          <p className="text-gray-500 text-sm mt-1">Manage commissioning checklists used on site visits</p>
        </div>
        <button onClick={startNew} className="btn-primary">+ Add template</button>
      </div>

      {showForm && (
        <div className="card p-5 mb-5">
          <h2 className="font-semibold text-gray-900 mb-4">{editing?'Edit template':'New template'}</h2>
          <div className="space-y-3 mb-4">
            <div><label className="label">Template name *</label><input className="input" value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Standard Gas Analyser Commissioning" /></div>
            <div><label className="label">Description</label><input className="input" value={description} onChange={e=>setDescription(e.target.value)} /></div>
          </div>

          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">Checklist items ({items.length})</h3>
            <button onClick={addItem} className="text-xs text-brand-500 hover:underline">+ Add item</button>
          </div>

          <div className="space-y-2 mb-4">
            {items.map((item, i) => (
              <div key={item.id} className="grid grid-cols-12 gap-2 items-center bg-gray-50 rounded-lg px-3 py-2">
                <div className="col-span-3">
                  <select className="input text-xs py-1" value={item.category} onChange={e=>updateItem(item.id,'category',e.target.value)}>
                    {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="col-span-6">
                  <input className="input text-xs py-1" value={item.item} onChange={e=>updateItem(item.id,'item',e.target.value)} placeholder="Checklist item description" />
                </div>
                <div className="col-span-2 flex items-center gap-1">
                  <input type="checkbox" checked={item.required} onChange={e=>updateItem(item.id,'required',e.target.checked)} className="rounded" />
                  <span className="text-xs text-gray-500">Required</span>
                </div>
                <div className="col-span-1 text-right">
                  <button onClick={()=>removeItem(item.id)} className="text-red-400 hover:text-red-600 text-sm">x</button>
                </div>
              </div>
            ))}
            {items.length === 0 && (
              <div className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-3">No items yet — click "+ Add item"</div>
            )}
          </div>

          <div className="flex gap-3">
            <button onClick={save} disabled={saving} className="btn-primary">{saving?'Saving...':editing?'Update':'Save template'}</button>
            <button onClick={()=>{setShowForm(false);setEditing(null)}} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="card p-8 text-center text-gray-400 text-sm">Loading...</div>
      ) : (
        <div className="space-y-4">
          {templates.map(t=>(
            <div key={t.id} className="card overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <div>
                  <div className="font-semibold text-gray-900">{t.name}</div>
                  {t.description && <div className="text-xs text-gray-400 mt-0.5">{t.description}</div>}
                  <div className="text-xs text-gray-400 mt-1">{(t.items||[]).length} items · {(t.items||[]).filter((i:any)=>i.required).length} required</div>
                </div>
                <div className="flex gap-3">
                  <button onClick={()=>startEdit(t)} className="text-xs text-brand-500 hover:underline">Edit</button>
                  <button onClick={()=>deleteTemplate(t.id)} className="text-xs text-red-400 hover:underline">Delete</button>
                </div>
              </div>
              <div className="px-5 py-3">
                {Object.entries(groupedItems(t.items||[])).map(([cat, catItems])=>(
                  <div key={cat} className="mb-2">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{cat}</div>
                    <div className="space-y-0.5">
                      {(catItems as ChecklistItem[]).map((item: ChecklistItem)=>(
                        <div key={item.id} className="flex items-center gap-2 text-xs text-gray-600">
                          <span className="text-gray-300">□</span>
                          <span>{item.item}</span>
                          {item.required && <span className="text-red-400 text-xs">*</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {templates.length===0 && (
            <div className="card p-8 text-center text-gray-400 text-sm">No templates yet.</div>
          )}
        </div>
      )}
    </div>
  )
}
