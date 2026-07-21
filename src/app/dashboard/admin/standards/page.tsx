'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

const UNITS = ['ppm', '% vol', '% LEL', 'mg/m³', 'mg/l', 'µg/m³', 'ppb', '% v/v']
const STANDARD_TYPES = [
  { key: 'gas',         label: '🔬 Gas' },
  { key: 'pressure',    label: '📊 Pressure' },
  { key: 'temperature', label: '🌡 Temperature' },
  { key: 'electrical',  label: '⚡ Electrical' },
  { key: 'other',       label: '🔧 Other' },
]

const empty = {
  description: '', make: '', model: '', serial_number: '', certificate_no: '',
  concentration: '', unit: 'ppm', cal_date: '', cal_due_date: '',
  accreditation: 'UKAS', notes: '', active: true,
  standard_types: ['gas'] as string[],
  gas_concentrations: [] as any[],
  certificate_pdf_url: '',
}

export default function StandardsPage() {
  const [standards, setStandards] = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [editing, setEditing]     = useState<string|null>(null)
  const [form, setForm]           = useState<any>(empty)
  const [saving, setSaving]       = useState(false)
  const [gasRow, setGasRow]       = useState({ gas: 'O2', concentration: '', unit: '% vol' })
  const [filter, setFilter]       = useState('all')
  const supabase = createClient()

  async function load() {
    const { data } = await supabase.from('reference_standards').select('*').order('description')
    setStandards(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function startNew() {
    setEditing(null); setForm(empty); setShowForm(true); window.scrollTo(0,0)
  }

  function startEdit(s: any) {
    setEditing(s.id)
    setForm({
      description: s.description||'', make: s.make||'', model: s.model||'',
      serial_number: s.serial_number||'', certificate_no: s.certificate_no||'',
      concentration: s.concentration||'', unit: s.unit||'ppm',
      cal_date: s.cal_date||'', cal_due_date: s.cal_due_date||'',
      accreditation: s.accreditation||'UKAS', notes: s.notes||'',
      active: s.active!==false,
      standard_types: s.standard_types || ['gas'],
      gas_concentrations: s.gas_concentrations || [],
      certificate_pdf_url: s.certificate_pdf_url || '',
    })
    setShowForm(true); window.scrollTo(0,0)
  }

  function toggleType(key: string) {
    setForm((f: any) => ({
      ...f,
      standard_types: f.standard_types.includes(key)
        ? f.standard_types.filter((t: string) => t !== key)
        : [...f.standard_types, key]
    }))
  }

  function addGasRow() {
    if (!gasRow.concentration) return
    setForm((f: any) => ({
      ...f,
      gas_concentrations: [...(f.gas_concentrations||[]), { ...gasRow }]
    }))
    setGasRow({ gas: 'O2', concentration: '', unit: '% vol' })
  }

  function removeGasRow(i: number) {
    setForm((f: any) => ({
      ...f,
      gas_concentrations: f.gas_concentrations.filter((_: any, idx: number) => idx !== i)
    }))
  }

  async function save() {
    if (!form.description) return alert('Description is required.')
    if (form.standard_types.length === 0) return alert('Please select at least one standard type.')
    setSaving(true)
    const payload = {
      description: form.description, make: form.make||null, model: form.model||null,
      serial_number: form.serial_number||null, certificate_no: form.certificate_no||null,
      cal_date: form.cal_date||null, cal_due_date: form.cal_due_date||null,
      accreditation: form.accreditation||null, notes: form.notes||null,
      active: form.active,
      standard_types: form.standard_types,
      gas_concentrations: form.gas_concentrations.length > 0 ? form.gas_concentrations : null,
      certificate_pdf_url: form.certificate_pdf_url||null,
    }
    if (editing) {
      await supabase.from('reference_standards').update(payload).eq('id', editing)
    } else {
      await supabase.from('reference_standards').insert(payload)
    }
    setSaving(false); setShowForm(false); setEditing(null); setForm(empty); load()
  }

  async function toggleActive(s: any) {
    await supabase.from('reference_standards').update({ active: !s.active }).eq('id', s.id); load()
  }

  async function deleteStandard(id: string) {
    if (!confirm('Delete this reference standard?')) return
    await supabase.from('reference_standards').delete().eq('id', id); load()
  }

  async function handlePdfUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !editing) return
    const path = `standards/${editing}/${file.name}`
    const { error } = await supabase.storage.from('certificates').upload(path, file, { upsert: true })
    if (error) { alert(error.message); return }
    const { data: { publicUrl } } = supabase.storage.from('certificates').getPublicUrl(path)
    await supabase.from('reference_standards').update({ certificate_pdf_url: publicUrl }).eq('id', editing)
    setForm((f: any) => ({ ...f, certificate_pdf_url: publicUrl }))
    alert('Certificate uploaded!')
  }

  function set(k: string, v: any) { setForm((f: any) => ({ ...f, [k]: v })) }

  const filtered = filter === 'all' ? standards : standards.filter(s => (s.standard_types || ['gas']).includes(filter))
  const isGas = form.standard_types?.includes('gas')

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Reference standards</h1>
          <p className="text-gray-500 text-sm mt-1">{standards.length} standards · gas bottles, pressure references & more</p>
        </div>
        <button onClick={startNew} className="btn-primary">+ Add standard</button>
      </div>

      {showForm && (
        <div className="card p-5 mb-5">
          <h2 className="font-semibold text-gray-900 mb-4">{editing ? 'Edit standard' : 'New standard'}</h2>

          {/* Standard types */}
          <div className="mb-4">
            <label className="label">Used for *</label>
            <div className="flex flex-wrap gap-2">
              {STANDARD_TYPES.map(t => (
                <button key={t.key} onClick={() => toggleType(t.key)}
                  className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${form.standard_types?.includes(t.key) ? 'bg-brand-500 text-white border-brand-500' : 'bg-white text-gray-500 border-gray-200 hover:border-brand-300'}`}>
                  {t.label}
                </button>
              ))}
            </div>
            {form.standard_types?.length === 0 && <p className="text-xs text-red-500 mt-1">Please select at least one type</p>}
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="col-span-2"><label className="label">Description *</label><input className="input" value={form.description} onChange={e=>set('description',e.target.value)} placeholder="e.g. PACE 5000 Pressure Controller, H2S 292ppm balance N2" /></div>
            <div><label className="label">Make</label><input className="input" value={form.make} onChange={e=>set('make',e.target.value)} placeholder="e.g. Druck, BOC" /></div>
            <div><label className="label">Model</label><input className="input" value={form.model} onChange={e=>set('model',e.target.value)} /></div>
            <div><label className="label">Serial number</label><input className="input" value={form.serial_number} onChange={e=>set('serial_number',e.target.value)} /></div>
            <div><label className="label">Certificate no.</label><input className="input" value={form.certificate_no} onChange={e=>set('certificate_no',e.target.value)} /></div>
            <div><label className="label">Cal date</label><input className="input" type="date" value={form.cal_date} onChange={e=>set('cal_date',e.target.value)} /></div>
            <div><label className="label">Cal due date</label><input className="input" type="date" value={form.cal_due_date} onChange={e=>set('cal_due_date',e.target.value)} /></div>
            <div><label className="label">Accreditation</label><input className="input" value={form.accreditation} onChange={e=>set('accreditation',e.target.value)} placeholder="e.g. UKAS" /></div>
          </div>

          {/* Gas concentrations - only for gas type */}
          {isGas && (
            <div className="mb-3">
              <label className="label">Gas concentrations</label>
              {(form.gas_concentrations||[]).length > 0 && (
                <div className="mb-2 space-y-1">
                  {form.gas_concentrations.map((g: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 bg-brand-50 rounded-lg px-3 py-1.5">
                      <span className="text-xs font-semibold text-brand-700 w-12">{g.gas}</span>
                      <span className="text-xs text-gray-700 flex-1">{g.concentration} {g.unit}</span>
                      <button onClick={() => removeGasRow(i)} className="text-red-400 text-xs hover:underline">remove</button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2 items-end">
                <div>
                  <select className="input text-xs py-1" value={gasRow.gas} onChange={e=>setGasRow(g=>({...g,gas:e.target.value}))}>
                    {['O2','CO','CO2','CH4','H2S','NO','NO2','SO2','CxHy'].map(g=><option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div><input className="input text-xs py-1" placeholder="Concentration" value={gasRow.concentration} onChange={e=>setGasRow(g=>({...g,concentration:e.target.value}))} style={{width:120}} /></div>
                <div>
                  <select className="input text-xs py-1" value={gasRow.unit} onChange={e=>setGasRow(g=>({...g,unit:e.target.value}))}>
                    {UNITS.map(u=><option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <button onClick={addGasRow} className="btn-secondary text-xs py-1.5">+ Add gas</button>
              </div>
            </div>
          )}

          <div className="mb-3"><label className="label">Notes</label><textarea className="input" rows={2} value={form.notes} onChange={e=>set('notes',e.target.value)} /></div>

          {/* PDF upload - only when editing */}
          {editing && (
            <div className="mb-3">
              <label className="label">Certificate PDF</label>
              {form.certificate_pdf_url && (
                <div className="mb-2">
                  <a href={form.certificate_pdf_url} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-500 hover:underline">View current certificate</a>
                </div>
              )}
              <input type="file" accept=".pdf" onChange={handlePdfUpload} className="text-xs text-gray-500" />
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
        <button onClick={()=>setFilter('all')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter==='all'?'bg-white shadow text-gray-900':'text-gray-500'}`}>
          All ({standards.length})
        </button>
        {STANDARD_TYPES.map(t => {
          const count = standards.filter(s=>(s.standard_types||['gas']).includes(t.key)).length
          if (!count) return null
          return (
            <button key={t.key} onClick={()=>setFilter(t.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${filter===t.key?'bg-white shadow text-gray-900':'text-gray-500'}`}>
              {t.label} ({count})
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="card p-8 text-center text-gray-400 text-sm">Loading...</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase bg-gray-50">
                <th className="px-5 py-3 text-left">Description</th>
                <th className="px-5 py-3 text-left">Types</th>
                <th className="px-5 py-3 text-left">Serial no.</th>
                <th className="px-5 py-3 text-left">Cert no.</th>
                <th className="px-5 py-3 text-left">Cal due</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(s => (
                <tr key={s.id} className={`hover:bg-gray-50 ${s.active===false?'opacity-50':''}`}>
                  <td className="px-5 py-3">
                    <div className="font-medium text-gray-900">{s.description}</div>
                    {s.gas_concentrations?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {s.gas_concentrations.map((g: any, i: number) => (
                          <span key={i} className="badge-info font-mono text-xs">{g.gas}: {g.concentration} {g.unit}</span>
                        ))}
                      </div>
                    )}
                    {s.certificate_pdf_url && (
                      <a href={s.certificate_pdf_url} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-500 hover:underline mt-0.5 block">View certificate</a>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(s.standard_types||['gas']).map((t: string) => (
                        <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                          {STANDARD_TYPES.find(st=>st.key===t)?.label || t}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-gray-500">{s.serial_number||'—'}</td>
                  <td className="px-5 py-3 font-mono text-xs text-gray-500">{s.certificate_no||'—'}</td>
                  <td className="px-5 py-3 text-xs">
                    {s.cal_due_date ? (
                      <span className={new Date(s.cal_due_date) < new Date() ? 'text-red-600 font-semibold' : 'text-gray-600'}>
                        {new Date(s.cal_due_date).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}
                        {new Date(s.cal_due_date) < new Date() && ' ⚠ Overdue'}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-5 py-3">
                    {s.active!==false ? <span className="badge-pass">Active</span> : <span className="badge-gray">Archived</span>}
                  </td>
                  <td className="px-5 py-3 text-right space-x-3">
                    <button onClick={()=>startEdit(s)} className="text-xs text-brand-500 hover:underline">Edit</button>
                    <button onClick={()=>toggleActive(s)} className="text-xs text-amber-500 hover:underline">{s.active===false?'Restore':'Archive'}</button>
                    <button onClick={()=>deleteStandard(s.id)} className="text-xs text-red-400 hover:underline">Delete</button>
                  </td>
                </tr>
              ))}
              {filtered.length===0 && (
                <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-400 text-sm">No standards found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
