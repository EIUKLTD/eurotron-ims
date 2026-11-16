'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

const STANDARD_TYPES = [
  { key: 'gas',         label: '🔬 Gas' },
  { key: 'pressure',    label: '📊 Pressure' },
  { key: 'temperature', label: '🌡 Temperature' },
  { key: 'electrical',  label: '⚡ Electrical' },
  { key: 'other',       label: '🔧 Other' },
]

type Tab = 'makes' | 'models' | 'descriptions' | 'accreditations'

export default function StandardListsPage() {
  const [tab, setTab]                     = useState<Tab>('makes')
  const [makes, setMakes]                 = useState<any[]>([])
  const [models, setModels]               = useState<any[]>([])
  const [descriptions, setDescriptions]   = useState<any[]>([])
  const [accreditations, setAccreditations] = useState<any[]>([])
  const [loading, setLoading]             = useState(true)

  // Form state
  const [newMake, setNewMake]             = useState('')
  const [newModelMakeId, setNewModelMakeId] = useState('')
  const [newModelName, setNewModelName]   = useState('')
  const [newDesc, setNewDesc]             = useState('')
  const [newDescType, setNewDescType]     = useState('gas')
  const [newAccred, setNewAccred]         = useState('')
  const [saving, setSaving]               = useState(false)

  const supabase = createClient()

  async function load() {
    const [{ data: mk }, { data: mo }, { data: ds }, { data: ac }] = await Promise.all([
      supabase.from('standard_makes').select('*').order('name'),
      supabase.from('standard_models').select('*, standard_makes(name)').order('name'),
      supabase.from('standard_descriptions').select('*').order('description'),
      supabase.from('standard_accreditations').select('*').order('name'),
    ])
    setMakes(mk||[]); setModels(mo||[]); setDescriptions(ds||[]); setAccreditations(ac||[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // ── Makes ──────────────────────────────────────────────────────────────────
  async function addMake() {
    if (!newMake.trim()) return
    setSaving(true)
    const { error } = await supabase.from('standard_makes').insert({ name: newMake.trim() })
    if (error) { alert(error.message); setSaving(false); return }
    setNewMake(''); setSaving(false); load()
  }

  async function toggleMake(m: any) {
    await supabase.from('standard_makes').update({ active: !m.active }).eq('id', m.id); load()
  }

  async function deleteMake(id: string) {
    if (!confirm('Delete this make? Associated models will also be deleted.')) return
    await supabase.from('standard_makes').delete().eq('id', id); load()
  }

  // ── Models ─────────────────────────────────────────────────────────────────
  async function addModel() {
    if (!newModelMakeId || !newModelName.trim()) return alert('Select a make and enter a model name.')
    setSaving(true)
    const { error } = await supabase.from('standard_models').insert({ make_id: newModelMakeId, name: newModelName.trim() })
    if (error) { alert(error.message); setSaving(false); return }
    setNewModelName(''); setSaving(false); load()
  }

  async function deleteModel(id: string) {
    if (!confirm('Delete this model?')) return
    await supabase.from('standard_models').delete().eq('id', id); load()
  }

  // ── Descriptions ───────────────────────────────────────────────────────────
  async function addDescription() {
    if (!newDesc.trim()) return
    setSaving(true)
    const { error } = await supabase.from('standard_descriptions').insert({ description: newDesc.trim(), standard_type: newDescType })
    if (error) { alert(error.message); setSaving(false); return }
    setNewDesc(''); setSaving(false); load()
  }

  async function toggleDesc(d: any) {
    await supabase.from('standard_descriptions').update({ active: !d.active }).eq('id', d.id); load()
  }

  async function deleteDesc(id: string) {
    if (!confirm('Delete this description?')) return
    await supabase.from('standard_descriptions').delete().eq('id', id); load()
  }

  // ── Accreditations ─────────────────────────────────────────────────────────
  async function addAccred() {
    if (!newAccred.trim()) return
    setSaving(true)
    const { error } = await supabase.from('standard_accreditations').insert({ name: newAccred.trim() })
    if (error) { alert(error.message); setSaving(false); return }
    setNewAccred(''); setSaving(false); load()
  }

  async function toggleAccred(a: any) {
    await supabase.from('standard_accreditations').update({ active: !a.active }).eq('id', a.id); load()
  }

  async function deleteAccred(id: string) {
    if (!confirm('Delete this accreditation?')) return
    await supabase.from('standard_accreditations').delete().eq('id', id); load()
  }

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'makes',          label: 'Makes',          count: makes.length },
    { key: 'models',         label: 'Models',         count: models.length },
    { key: 'descriptions',   label: 'Descriptions',   count: descriptions.length },
    { key: 'accreditations', label: 'Accreditations', count: accreditations.length },
  ]

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Reference standard lists</h1>
        <p className="text-gray-500 text-sm mt-1">Manage the dropdown options used when adding reference standards</p>
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
                <p className="text-xs text-gray-400 mt-0.5">Manufacturers / suppliers of reference standards and gas bottles</p>
              </div>
              {/* Add row */}
              <div className="px-5 py-3 border-b border-gray-100 flex gap-2">
                <input className="input flex-1" value={newMake} onChange={e => setNewMake(e.target.value)}
                  placeholder="e.g. BOC, Air Products, Druck, Fluke"
                  onKeyDown={e => e.key === 'Enter' && addMake()} />
                <button onClick={addMake} disabled={saving} className="btn-primary text-sm">Add</button>
              </div>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-50">
                  {makes.map(m => (
                    <tr key={m.id} className={`hover:bg-gray-50 ${m.active === false ? 'opacity-50' : ''}`}>
                      <td className="px-5 py-2.5 font-medium text-gray-800">{m.name}</td>
                      <td className="px-5 py-2.5 text-xs text-gray-400">{models.filter(mo => mo.make_id === m.id).length} models</td>
                      <td className="px-5 py-2.5 text-right space-x-3">
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

          {/* ── Models ── */}
          {tab === 'models' && (
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
                <h2 className="font-semibold text-gray-700 text-sm">Models</h2>
                <p className="text-xs text-gray-400 mt-0.5">Model names linked to each make</p>
              </div>
              <div className="px-5 py-3 border-b border-gray-100 flex gap-2">
                <select className="input w-40" value={newModelMakeId} onChange={e => setNewModelMakeId(e.target.value)}>
                  <option value="">— Make —</option>
                  {makes.filter(m => m.active !== false).map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
                <input className="input flex-1" value={newModelName} onChange={e => setNewModelName(e.target.value)}
                  placeholder="e.g. PACE 5000, Fluke 724"
                  onKeyDown={e => e.key === 'Enter' && addModel()} />
                <button onClick={addModel} disabled={saving} className="btn-primary text-sm">Add</button>
              </div>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-50">
                  {models.map(m => (
                    <tr key={m.id} className="hover:bg-gray-50">
                      <td className="px-5 py-2.5 text-xs text-gray-400 w-32">{m.standard_makes?.name || '—'}</td>
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
                <p className="text-xs text-gray-400 mt-0.5">Standard descriptions e.g. "H2S 292ppm balance N2", "PACE 5000 Pressure Controller"</p>
              </div>
              <div className="px-5 py-3 border-b border-gray-100 flex gap-2">
                <select className="input w-36" value={newDescType} onChange={e => setNewDescType(e.target.value)}>
                  {STANDARD_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
                <input className="input flex-1" value={newDesc} onChange={e => setNewDesc(e.target.value)}
                  placeholder="e.g. H2S 292ppm balance N2"
                  onKeyDown={e => e.key === 'Enter' && addDescription()} />
                <button onClick={addDescription} disabled={saving} className="btn-primary text-sm">Add</button>
              </div>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-50">
                  {descriptions.map(d => (
                    <tr key={d.id} className={`hover:bg-gray-50 ${d.active === false ? 'opacity-50' : ''}`}>
                      <td className="px-5 py-2.5 text-xs w-28">
                        <span className="text-gray-500">{STANDARD_TYPES.find(t => t.key === d.standard_type)?.label || d.standard_type}</span>
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

          {/* ── Accreditations ── */}
          {tab === 'accreditations' && (
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
                <h2 className="font-semibold text-gray-700 text-sm">Accreditations</h2>
                <p className="text-xs text-gray-400 mt-0.5">e.g. UKAS, NIST, ISO 17025, Traceable to NPL</p>
              </div>
              <div className="px-5 py-3 border-b border-gray-100 flex gap-2">
                <input className="input flex-1" value={newAccred} onChange={e => setNewAccred(e.target.value)}
                  placeholder="e.g. UKAS, NIST, DAkkS"
                  onKeyDown={e => e.key === 'Enter' && addAccred()} />
                <button onClick={addAccred} disabled={saving} className="btn-primary text-sm">Add</button>
              </div>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-50">
                  {accreditations.map(a => (
                    <tr key={a.id} className={`hover:bg-gray-50 ${a.active === false ? 'opacity-50' : ''}`}>
                      <td className="px-5 py-2.5 font-medium text-gray-800">{a.name}</td>
                      <td className="px-5 py-2.5 text-right space-x-3">
                        <button onClick={() => toggleAccred(a)} className="text-xs text-amber-500 hover:underline">{a.active === false ? 'Enable' : 'Disable'}</button>
                        <button onClick={() => deleteAccred(a.id)} className="text-xs text-red-400 hover:underline">Delete</button>
                      </td>
                    </tr>
                  ))}
                  {accreditations.length === 0 && <tr><td colSpan={2} className="px-5 py-6 text-center text-gray-400 text-xs">No accreditations yet</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
