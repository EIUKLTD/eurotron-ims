'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

const UNITS = ['ppm', '% vol', '% LEL', 'mg/m³', 'mg/l', 'µg/m³', 'ppb', '% v/v']
const empty = { description:'', make:'', model:'', serial_number:'', certificate_no:'', concentration:'', unit:'ppm', cal_date:'', cal_due_date:'', accreditation:'UKAS', notes:'' }

export default function StandardsPage() {
  const [standards, setStandards] = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [form, setForm]           = useState(empty)
  const [saving, setSaving]       = useState(false)
  const supabase = createClient()

  async function load() {
    const { data } = await supabase.from('reference_standards').select('*').order('description')
    setStandards(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function save() {
    if (!form.description || !form.serial_number) return alert('Description and serial number are required.')
    setSaving(true)
    const { error } = await supabase.from('reference_standards').insert({ ...form, active: true })
    setSaving(false)
    if (error) { alert(error.message); return }
    setShowForm(false); setForm(empty); load()
  }

  async function deleteStd(id: string) {
    if (!confirm('Delete this reference standard?')) return
    await supabase.from('reference_standards').delete().eq('id', id)
    load()
  }

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Reference standards</h1>
          <p className="text-gray-500 text-sm mt-1">Span gases and reference instruments used for calibration</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">+ Add standard</button>
      </div>

      {showForm && (
        <div className="card p-5 mb-5">
          <h2 className="font-semibold text-gray-900 mb-4">New reference standard</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label">Description *</label>
              <input className="input" value={form.description} onChange={e=>set('description',e.target.value)} placeholder="e.g. CO span gas BOC" />
            </div>
            <div><label className="label">Make / supplier</label><input className="input" value={form.make} onChange={e=>set('make',e.target.value)} placeholder="e.g. BOC Gases" /></div>
            <div><label className="label">Model / grade</label><input className="input" value={form.model} onChange={e=>set('model',e.target.value)} placeholder="e.g. Traceable Certified Mix" /></div>

            {/* Concentration + Unit side by side */}
            <div>
              <label className="label">Concentration</label>
              <input className="input" value={form.concentration} onChange={e=>set('concentration',e.target.value)} placeholder="e.g. 1000" />
            </div>
            <div>
              <label className="label">Unit</label>
              <select className="input" value={form.unit} onChange={e=>set('unit',e.target.value)}>
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>

            <div><label className="label">Serial number *</label><input className="input" value={form.serial_number} onChange={e=>set('serial_number',e.target.value)} placeholder="Cylinder / instrument S/N" /></div>
            <div><label className="label">Certificate number</label><input className="input" value={form.certificate_no} onChange={e=>set('certificate_no',e.target.value)} placeholder="e.g. UKAS cert no." /></div>
            <div><label className="label">Calibration date</label><input className="input" type="date" value={form.cal_date} onChange={e=>set('cal_date',e.target.value)} /></div>
            <div><label className="label">Cal due date</label><input className="input" type="date" value={form.cal_due_date} onChange={e=>set('cal_due_date',e.target.value)} /></div>
            <div><label className="label">Accreditation</label><input className="input" value={form.accreditation} onChange={e=>set('accreditation',e.target.value)} placeholder="e.g. UKAS, ISO 17025" /></div>
            <div><label className="label">Notes</label><input className="input" value={form.notes} onChange={e=>set('notes',e.target.value)} /></div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={save} disabled={saving} className="btn-primary">{saving?'Saving…':'Save standard'}</button>
            <button onClick={()=>setShowForm(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        {loading ? <div className="p-8 text-center text-gray-400 text-sm">Loading…</div> : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase bg-gray-50 text-left">
                <th className="px-5 py-3">Description</th>
                <th className="px-5 py-3">Concentration</th>
                <th className="px-5 py-3">Serial / Cert</th>
                <th className="px-5 py-3">Accreditation</th>
                <th className="px-5 py-3">Cal due</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {standards.map(s => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <div className="font-medium text-gray-900">{s.description}</div>
                    <div className="text-xs text-gray-400">{s.make} {s.model}</div>
                  </td>
                  <td className="px-5 py-3">
                    {s.concentration && s.unit
                      ? <span className="badge-info font-mono">{s.concentration} {s.unit}</span>
                      : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-5 py-3">
                    <div className="text-gray-700">{s.serial_number}</div>
                    <div className="text-xs text-gray-400">{s.certificate_no}</div>
                  </td>
                  <td className="px-5 py-3"><span className="badge-info">{s.accreditation || '—'}</span></td>
                  <td className="px-5 py-3 text-gray-700">{s.cal_due_date || '—'}</td>
                  <td className="px-5 py-3 text-right">
                    <button onClick={() => deleteStd(s.id)} className="text-xs text-red-400 hover:underline">Delete</button>
                  </td>
                </tr>
              ))}
              {standards.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-400 text-sm">No reference standards yet. Add your span gases above.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}