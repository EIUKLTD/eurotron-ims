'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

type Tab = 'makes' | 'categories' | 'models' | 'descriptions'

export default function InstrumentListsPage() {
  const [tab, setTab]               = useState<Tab>('makes')
  const [makes, setMakes]           = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [models, setModels]         = useState<any[]>([])
  const [descriptions, setDescs]    = useState<any[]>([])
  const [loading, setLoading]       = useState(true)

  // Makes form
  const [editingMake, setEditingMake] = useState<string|null>(null)
  const [makeName, setMakeName]       = useState('')

  // Categories form
  const [editingCat, setEditingCat]   = useState<string|null>(null)
  const [catKey, setCatKey]           = useState('')
  const [catLabel, setCatLabel]       = useState('')
  const [catIcon, setCatIcon]         = useState('🔧')
  const [catOrder, setCatOrder]       = useState('0')
  const [showCatForm, setShowCatForm] = useState(false)

  // Models form
  const [newModelMakeId, setNewModelMakeId] = useState('')
  const [newModelName, setNewModelName]     = useState('')

  // Descriptions form
  const [newDesc, setNewDesc]       = useState('')
  const [newDescCat, setNewDescCat] = useState('')

  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  async function load() {
    const [{ data: mk }, { data: cat }, { data: mo }, { data: ds }] = await Promise.all([
      supabase.from('instrument_makes').select('*').order('make'),
      supabase.from('instrument_categories').select('*').order('sort_order').order('label'),
      supabase.from('instrument_model_list').select('*, instrument_makes(make)').order('name'),
      supabase.from('instrument_desc_list').select('*').order('description'),
    ])
    setMakes(mk||[]); setCategories(cat||[]); setModels(mo||[]); setDescs(ds||[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // ── Makes ──────────────────────────────────────────────────────────────────
  async function saveMake() {
    if (!makeName.trim()) return
    setSaving(true)
    if (editingMake) {
      await supabase.from('instrument_makes').update({ make: makeName.trim() }).eq('id', editingMake)
    } else {
      await supabase.from('instrument_makes').insert({ make: makeName.trim() })
    }
    setMakeName(''); setEditingMake(null); setSaving(false); load()
  }

  async function toggleMake(m: any) {
    await supabase.from('instrument_makes').update({ active: !m.active }).eq('id', m.id); load()
  }

  async function deleteMake(id: string) {
    if (!confirm('Delete this make? Associated models will also be deleted.')) return
    await supabase.from('instrument_makes').delete().eq('id', id); load()
  }

  // ── Categories ─────────────────────────────────────────────────────────────
  function startNewCat() {
    setEditingCat(null); setCatKey(''); setCatLabel(''); setCatIcon('🔧'); setCatOrder('0')
    setShowCatForm(true)
  }

  function startEditCat(c: any) {
    setEditingCat(c.id); setCatKey(c.key); setCatLabel(c.label); setCatIcon(c.icon||'🔧')
    setCatOrder(String(c.sort_order||0)); setShowCatForm(true)
  }

  async function saveCat() {
    if (!catKey.trim() || !catLabel.trim()) return alert('Key and label are required.')
    setSaving(true)
    const payload = { key: catKey.trim().toLowerCase().replace(/\s+/g,'_'), label: catLabel.trim(), icon: catIcon, sort_order: parseInt(catOrder)||0 }
    if (editingCat) {
      await supabase.from('instrument_categories').update(payload).eq('id', editingCat)
    } else {
      await supabase.from('instrument_categories').insert(payload)
    }
    setShowCatForm(false); setEditingCat(null); setSaving(false); load()
  }

  async function toggleCat(c: any) {
    await supabase.from('instrument_categories').update({ active: !c.active }).eq('id', c.id); load()
  }

  async function deleteCat(id: string) {
    if (!confirm('Delete this category?')) return
    await supabase.from('instrument_categories').delete().eq('id', id); load()
  }

  // ── Models ─────────────────────────────────────────────────────────────────
  async function addModel() {
    if (!newModelMakeId || !newModelName.trim()) return alert('Select a make and enter a model name.')
    setSaving(true)
    const { error } = await supabase.from('instrument_model_list').insert({ make_id: newModelMakeId, name: newModelName.trim() })
    if (error) { alert(error.message); setSaving(false); return }
    setNewModelName(''); setSaving(false); load()
  }

  async function deleteModel(id: string) {
    if (!confirm('Delete this model?')) return
    await supabase.from('instrument_model_list').delete().eq('id', id); load()
  }

  // ── Descriptions ───────────────────────────────────────────────────────────
  async function addDesc() {
    if (!newDesc.trim()) return
    setSaving(true)
    const { error } = await supabase.from('instrument_desc_list').insert({ description: newDesc.trim(), category: newDescCat||null })
    if (error) { alert(error.message); setSaving(false); return }
    setNewDesc(''); setSaving(false); load()
  }

  async function toggleDesc(d: any) {
    await supabase.from('instrument_desc_list').update({ active: !d.active }).eq('id', d.id); load()
  }

  async function deleteDesc(id: string) {
    if (!confirm('Delete this description?')) return
    await supabase.from('instrument_desc_list').delete().eq('id', id); load()
  }

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'makes',        label: 'Makes',        count: makes.length },
    { key: 'categories',   label: 'Categories',   count: categories.length },
    { key: 'models',       label: 'Models',       count: models.length },
    { key: 'descriptions', label: 'Descriptions', count: descriptions.length },
  ]

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Instrument lists</h1>
        <p className="text-gray-500 text-sm mt-1">Manage the dropdown options used when creating instrument models and instruments</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-gray-100 rounded-xl p-1 w-fit">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === t.key ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.label} <span className="text-gray-400">({t.count})</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card p-8 text-center text-gray-400 text-sm">Loading...</div>
      ) : (
        <>
          {/* ── Makes ── */}
          {tab === 'makes' && (
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
                <h2 className="font-semibold text-gray-700 text-sm">Makes</h2>
                <p className="text-xs text-gray-400 mt-0.5">Instrument manufacturers</p>
              </div>
              <div className="px-5 py-3 border-b border-gray-100 flex gap-2">
                <input className="input flex-1" value={makeName} onChange={e => setMakeName(e.target.value)}
                  placeholder={editingMake ? 'Edit make name...' : 'e.g. Kane, Crowcon, Druck, Eurotron'}
                  onKeyDown={e => e.key === 'Enter' && saveMake()} />
                <button onClick={saveMake} disabled={saving} className="btn-primary text-sm">
                  {editingMake ? 'Update' : 'Add'}
                </button>
                {editingMake && (
                  <button onClick={() => { setEditingMake(null); setMakeName('') }} className="btn-secondary text-sm">Cancel</button>
                )}
              </div>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-50">
                  {makes.map(m => (
                    <tr key={m.id} className={`hover:bg-gray-50 ${m.active === false ? 'opacity-50' : ''}`}>
                      <td className="px-5 py-2.5 font-medium text-gray-800">{m.make}</td>
                      <td className="px-5 py-2.5 text-xs text-gray-400">{models.filter(mo => mo.make_id === m.id).length} models</td>
                      <td className="px-5 py-2.5 text-right space-x-3">
                        <button onClick={() => { setEditingMake(m.id); setMakeName(m.make) }} className="text-xs text-brand-500 hover:underline">Edit</button>
                        <button onClick={() => toggleMake(m)} className="text-xs text-amber-500 hover:underline">{m.active === false ? 'Enable' : 'Disable'}</button>
                        <button onClick={() => deleteMake(m.id)} className="text-xs text-red-400 hover:underline">Delete</button>
                      </td>
                    </tr>
                  ))}
                  {makes.length === 0 && <tr><td colSpan={3} className="px-5 py-6 text-center text-gray-400 text-xs">No makes yet</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Categories ── */}
          {tab === 'categories' && (
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-gray-700 text-sm">Categories</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Instrument types shown in the category selector</p>
                </div>
                <button onClick={startNewCat} className="btn-primary text-xs">+ Add category</button>
              </div>

              {showCatForm && (
                <div className="px-5 py-4 border-b border-gray-100 bg-blue-50 space-y-3">
                  <h3 className="text-xs font-semibold text-gray-700">{editingCat ? 'Edit category' : 'New category'}</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="label">Icon (emoji)</label>
                      <input className="input text-xs py-1" value={catIcon} onChange={e => setCatIcon(e.target.value)} placeholder="🔧" />
                    </div>
                    <div>
                      <label className="label">Sort order</label>
                      <input className="input text-xs py-1" type="number" value={catOrder} onChange={e => setCatOrder(e.target.value)} />
                    </div>
                    <div>
                      <label className="label">Key (no spaces) *</label>
                      <input className="input text-xs py-1" value={catKey} onChange={e => setCatKey(e.target.value)} placeholder="e.g. gas_analyser" />
                    </div>
                    <div>
                      <label className="label">Label *</label>
                      <input className="input text-xs py-1" value={catLabel} onChange={e => setCatLabel(e.target.value)} placeholder="e.g. Gas Analyser (Fixed)" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={saveCat} disabled={saving} className="btn-primary text-xs">{editingCat ? 'Update' : 'Save'}</button>
                    <button onClick={() => { setShowCatForm(false); setEditingCat(null) }} className="btn-secondary text-xs">Cancel</button>
                  </div>
                </div>
              )}

              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-50">
                  {categories.map(c => (
                    <tr key={c.id} className={`hover:bg-gray-50 ${c.active === false ? 'opacity-50' : ''}`}>
                      <td className="px-5 py-2.5 w-10 text-center text-base">{c.icon}</td>
                      <td className="px-5 py-2.5 font-medium text-gray-800">{c.label}</td>
                      <td className="px-5 py-2.5 font-mono text-xs text-gray-400">{c.key}</td>
                      <td className="px-5 py-2.5 text-xs text-gray-400 w-16">#{c.sort_order}</td>
                      <td className="px-5 py-2.5 text-right space-x-3">
                        <button onClick={() => startEditCat(c)} className="text-xs text-brand-500 hover:underline">Edit</button>
                        <button onClick={() => toggleCat(c)} className="text-xs text-amber-500 hover:underline">{c.active === false ? 'Enable' : 'Disable'}</button>
                        <button onClick={() => deleteCat(c.id)} className="text-xs text-red-400 hover:underline">Delete</button>
                      </td>
                    </tr>
                  ))}
                  {categories.length === 0 && <tr><td colSpan={5} className="px-5 py-6 text-center text-gray-400 text-xs">No categories yet</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Models ── */}
          {tab === 'models' && (
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
                <h2 className="font-semibold text-gray-700 text-sm">Models</h2>
                <p className="text-xs text-gray-400 mt-0.5">Model names linked to each make — used as dropdowns when creating instrument models</p>
              </div>
              <div className="px-5 py-3 border-b border-gray-100 flex gap-2">
                <select className="input w-40" value={newModelMakeId} onChange={e => setNewModelMakeId(e.target.value)}>
                  <option value="">— Make —</option>
                  {makes.filter(m => m.active !== false).map(m => (
                    <option key={m.id} value={m.id}>{m.make}</option>
                  ))}
                </select>
                <input className="input flex-1" value={newModelName} onChange={e => setNewModelName(e.target.value)}
                  placeholder="e.g. RASI 700, KANE 9206, PACE 5000"
                  onKeyDown={e => e.key === 'Enter' && addModel()} />
                <button onClick={addModel} disabled={saving} className="btn-primary text-sm">Add</button>
              </div>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-50">
                  {models.map(m => (
                    <tr key={m.id} className="hover:bg-gray-50">
                      <td className="px-5 py-2.5 text-xs text-gray-400 w-32">{m.instrument_makes?.make || '—'}</td>
                      <td className="px-5 py-2.5 font-medium text-gray-800">{m.name}</td>
                      <td className="px-5 py-2.5 text-right">
                        <button onClick={() => deleteModel(m.id)} className="text-xs text-red-400 hover:underline">Delete</button>
                      </td>
                    </tr>
                  ))}
                  {models.length === 0 && <tr><td colSpan={3} className="px-5 py-6 text-center text-gray-400 text-xs">No models yet</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Descriptions ── */}
          {tab === 'descriptions' && (
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
                <h2 className="font-semibold text-gray-700 text-sm">Descriptions</h2>
                <p className="text-xs text-gray-400 mt-0.5">Standard instrument descriptions used in the model form</p>
              </div>
              <div className="px-5 py-3 border-b border-gray-100 flex gap-2">
                <select className="input w-44" value={newDescCat} onChange={e => setNewDescCat(e.target.value)}>
                  <option value="">— Category (optional) —</option>
                  {categories.filter(c => c.active !== false).map(c => (
                    <option key={c.id} value={c.key}>{c.icon} {c.label}</option>
                  ))}
                </select>
                <input className="input flex-1" value={newDesc} onChange={e => setNewDesc(e.target.value)}
                  placeholder="e.g. Portable Flue Gas Analyser"
                  onKeyDown={e => e.key === 'Enter' && addDesc()} />
                <button onClick={addDesc} disabled={saving} className="btn-primary text-sm">Add</button>
              </div>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-50">
                  {descriptions.map(d => (
                    <tr key={d.id} className={`hover:bg-gray-50 ${d.active === false ? 'opacity-50' : ''}`}>
                      <td className="px-5 py-2.5 text-xs text-gray-400 w-44">
                        {categories.find(c => c.key === d.category)
                          ? `${categories.find(c => c.key === d.category).icon} ${categories.find(c => c.key === d.category).label}`
                          : <span className="text-gray-300">All</span>}
                      </td>
                      <td className="px-5 py-2.5 font-medium text-gray-800">{d.description}</td>
                      <td className="px-5 py-2.5 text-right space-x-3">
                        <button onClick={() => toggleDesc(d)} className="text-xs text-amber-500 hover:underline">{d.active === false ? 'Enable' : 'Disable'}</button>
                        <button onClick={() => deleteDesc(d.id)} className="text-xs text-red-400 hover:underline">Delete</button>
                      </td>
                    </tr>
                  ))}
                  {descriptions.length === 0 && <tr><td colSpan={3} className="px-5 py-6 text-center text-gray-400 text-xs">No descriptions yet</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
