'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

const UNITS = ['ppm', '% vol', '% LEL', 'mg/m3', 'mg/l', 'ppb', '% v/v']
const GASES = ['CO', 'CO2', 'O2', 'NO', 'NO2', 'SO2', 'H2S', 'CH4', 'CxHy', 'HC', 'NOx', 'N2']

const empty = {
  description:'', make:'', model:'', serial_number:'', certificate_no:'',
  cal_date:'', cal_due_date:'', accreditation:'UKAS', notes:'',
  gas_concentrations: [] as {gas:string, concentration:string, unit:string}[]
}

export default function StandardsPage() {
  const [standards, setStandards] = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [editing, setEditing]     = useState<string|null>(null)
  const [form, setForm]           = useState<any>(empty)
  const [saving, setSaving]       = useState(false)
  const supabase = createClient()

  async function load() {
    const { data } = await supabase.from('reference_standards').select('*').order('description')
    setStandards(data||[])
    setLoading(false)
  }

  useEffect(()=>{ load() },[])

  function startEdit(s:any) {
    setEditing(s.id)
    setForm({
      description: s.description||'',
      make: s.make||'',
      model: s.model||'',
      serial_number: s.serial_number||'',
      certificate_no: s.certificate_no||'',
      cal_date: s.cal_date||'',
      cal_due_date: s.cal_due_date||'',
      accreditation: s.accreditation||'UKAS',
      notes: s.notes||'',
      gas_concentrations: s.gas_concentrations||[]
    })
    setShowForm(true)
    window.scrollTo(0,0)
  }

  function startNew() {
    setEditing(null)
    setForm({...empty, gas_concentrations:[]})
    setShowForm(true)
  }

  function addGasLine() {
    setForm((f:any)=>({...f, gas_concentrations:[...f.gas_concentrations, {gas:'CO', concentration:'', unit:'ppm'}]}))
  }

  function removeGasLine(i:number) {
    setForm((f:any)=>({...f, gas_concentrations:f.gas_concentrations.filter((_:any,idx:number)=>idx!==i)}))
  }

  function updateGasLine(i:number, key:string, val:string) {
    setForm((f:any)=>{
      const updated = [...f.gas_concentrations]
      updated[i] = {...updated[i], [key]:val}
      return {...f, gas_concentrations:updated}
    })
  }

  async function save() {
    if (!form.description||!form.serial_number) return alert('Description and serial number are required.')
    setSaving(true)
    const payload = {...form}
    if (editing) {
      const { error } = await supabase.from('reference_standards').update(payload).eq('id', editing)
      if (error) { alert(error.message); setSaving(false); return }
    } else {
      const { error } = await supabase.from('reference_standards').insert({...payload, active:true})
      if (error) { alert(error.message); setSaving(false); return }
    }
    setSaving(false); setShowForm(false); setEditing(null); setForm({...empty,gas_concentrations:[]}); load()
  }

  function cancel() {
    setShowForm(false); setEditing(null); setForm({...empty,gas_concentrations:[]})
  }

  async function deleteStd(id:string) {
    if (!confirm('Delete this reference standard?')) return
    await supabase.from('reference_standards').delete().eq('id', id)
    load()
  }

  function set(k:string,v:string){ setForm((f:any)=>({...f,[k]:v})) }

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Reference standards</h1>
          <p className="text-gray-500 text-sm mt-1">Span gas cylinders and reference instruments</p>
        </div>
        <button onClick={startNew} className="btn-primary">+ Add standard</button>
      </div>

      {showForm && (
        <div className="card p-5 mb-5">
          <h2 className="font-semibold text-gray-900 mb-4">{editing?'Edit reference standard':'New reference standard'}</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label">Description *</label>
              <input className="input" value={form.description} onChange={e=>set('description',e.target.value)} placeholder="e.g. Multi-gas mix BOC CH4/CO2/H2S balance N2" />
            </div>
            <div><label className="label">Make / supplier</label><input className="input" value={form.make} onChange={e=>set('make',e.target.value)} placeholder="e.g. BOC Gases" /></div>
            <div><label className="label">Model / grade</label><input className="input" value={form.model} onChange={e=>set('model',e.target.value)} placeholder="e.g. Traceable Certified Mix" /></div>
            <div><label className="label">Serial number *</label><input className="input" value={form.serial_number} onChange={e=>set('serial_number',e.target.value)} placeholder="Cylinder S/N" /></div>
            <div><label className="label">Certificate number</label><input className="input" value={form.certificate_no} onChange={e=>set('certificate_no',e.target.value)} placeholder="e.g. UKAS cert no." /></div>
            <div><label className="label">Calibration date</label><input className="input" type="date" value={form.cal_date} onChange={e=>set('cal_date',e.target.value)} /></div>
            <div><label className="label">Cal due date</label><input className="input" type="date" value={form.cal_due_date} onChange={e=>set('cal_due_date',e.target.value)} /></div>
            <div><label className="label">Accreditation</label><input className="input" value={form.accreditation} onChange={e=>set('accreditation',e.target.value)} placeholder="e.g. UKAS" /></div>
            <div><label className="label">Notes</label><input className="input" value={form.notes} onChange={e=>set('notes',e.target.value)} /></div>
          </div>

          {/* Gas concentrations */}
          <div className="mt-5">
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0 font-semibold text-gray-700">Gas concentrations in this bottle</label>
              <button onClick={addGasLine} className="text-xs text-brand-500 hover:underline">+ Add gas</button>
            </div>

            {form.gas_concentrations.length === 0 && (
              <div className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
                No gases added yet — click "+ Add gas" to add CH4, CO2, H2S etc.
              </div>
            )}

            <div className="space-y-2 mt-2">
              {form.gas_concentrations.map((g:any, i:number)=>(
                <div key={i} className="grid grid-cols-12 gap-2 items-center bg-gray-50 rounded-lg px-3 py-2">
                  <div className="col-span-3">
                    <label className="label">Gas</label>
                    <select className="input text-sm py-1.5" value={g.gas} onChange={e=>updateGasLine(i,'gas',e.target.value)}>
                      {GASES.map(gas=><option key={gas} value={gas}>{gas}</option>)}
                    </select>
                  </div>
                  <div className="col-span-4">
                    <label className="label">Concentration</label>
                    <input className="input text-sm py-1.5" value={g.concentration} onChange={e=>updateGasLine(i,'concentration',e.target.value)} placeholder="e.g. 1000" />
                  </div>
                  <div className="col-span-4">
                    <label className="label">Unit</label>
                    <select className="input text-sm py-1.5" value={g.unit} onChange={e=>updateGasLine(i,'unit',e.target.value)}>
                      {UNITS.map(u=><option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div className="col-span-1 pt-4">
                    <button onClick={()=>removeGasLine(i)} className="text-red-400 hover:text-red-600 text-lg leading-none">x</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 mt-5">
            <button onClick={save} disabled={saving} className="btn-primary">
              {saving?'Saving...':editing?'Update standard':'Save standard'}
            </button>
            <button onClick={cancel} className="btn-secondary">Cancel</button>
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
                <th className="px-5 py-3">Description</th>
                <th className="px-5 py-3">Gases / concentrations</th>
                <th className="px-5 py-3">Serial / Cert</th>
                <th className="px-5 py-3">Cal due</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {standards.map(s=>(
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <div className="font-medium text-gray-900">{s.description}</div>
                    <div className="text-xs text-gray-400">{s.make} {s.model}</div>
                    {s.accreditation&&<span className="badge-info text-xs mt-1">{s.accreditation}</span>}
                  </td>
                  <td className="px-5 py-3">
                    {s.gas_concentrations&&s.gas_concentrations.length>0 ? (
                      <div className="flex flex-wrap gap-1">
                        {s.gas_concentrations.map((g:any,i:number)=>(
                          <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 font-mono">
                            {g.gas}: {g.concentration} {g.unit}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-400 text-xs">No gases listed</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <div className="text-gray-700">{s.serial_number}</div>
                    <div className="text-xs text-gray-400">{s.certificate_no}</div>
                  </td>
                  <td className="px-5 py-3 text-gray-700">{s.cal_due_date||'—'}</td>
                  <td className="px-5 py-3 text-right space-x-3">
                    <button onClick={()=>startEdit(s)} className="text-xs text-brand-500 hover:underline">Edit</button>
                    <button onClick={()=>deleteStd(s.id)} className="text-xs text-red-400 hover:underline">Delete</button>
                  </td>
                </tr>
              ))}
              {standards.length===0&&(
                <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-400 text-sm">No reference standards yet. Add your first bottle above.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}