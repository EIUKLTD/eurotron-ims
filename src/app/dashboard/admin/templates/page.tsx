'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

const GASES = ['O2','CO','CO2','CH4','H2S','NO','NO2','SO2','CxHy','HC','NOx']
const UNITS = ['ppm','% vol','% LEL','mg/m3','ppb','% v/v']

type ToleranceType = 'fixed_abs' | 'pct_of_nominal'
type NominalType = 'fixed' | 'from_bottle'

interface Parameter {
  parameter: string
  gas: string
  nominal_type: NominalType
  nominal: string
  unit: string
  tolerance_type: ToleranceType
  tolerance: string
  tolerance_unit: string
}

const TRACEABILITY = 'This certificate is produced by using test gases which are produced in accordance to ISO 6141. The certified results shown below are traceable to gas reference material or to mass traceable to national standard.'

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [editing, setEditing]     = useState<string|null>(null)
  const [name, setName]           = useState('')
  const [description, setDescription] = useState('')
  const [testMethod, setTestMethod] = useState('Comparison against certified reference gas standards produced in accordance with ISO 6141')
  const [params, setParams]       = useState<Parameter[]>([])
  const [saving, setSaving]       = useState(false)
  const supabase = createClient()

  async function load() {
    const { data } = await supabase.from('cal_templates').select('*').order('name')
    setTemplates(data||[])
    setLoading(false)
  }

  useEffect(()=>{ load() },[])

  function startNew() {
    setEditing(null); setName(''); setDescription('')
    setTestMethod('Comparison against certified reference gas standards produced in accordance with ISO 6141')
    setParams([]); setShowForm(true)
  }

  function startEdit(t:any) {
    setEditing(t.id); setName(t.name||''); setDescription(t.description||'')
    setTestMethod(t.test_method||'')
    setParams(t.parameters||[]); setShowForm(true); window.scrollTo(0,0)
  }

  function addParam() {
    setParams(p=>[...p, {
      parameter:'', gas:'CO2', nominal_type:'from_bottle',
      nominal:'', unit:'% vol', tolerance_type:'fixed_abs',
      tolerance:'', tolerance_unit:'ppm'
    }])
  }

  function removeParam(i:number) { setParams(p=>p.filter((_,idx)=>idx!==i)) }

  function updateParam(i:number, key:string, val:string) {
    setParams(p=>{ const updated=[...p]; updated[i]={...updated[i],[key]:val}; return updated })
  }

  async function save() {
    if (!name) return alert('Template name is required.')
    if (!params.length) return alert('Add at least one parameter.')
    setSaving(true)
    const payload = { name, description, test_method: testMethod, parameters: params, active: true }
    if (editing) {
      const { error } = await supabase.from('cal_templates').update(payload).eq('id', editing)
      if (error) { alert(error.message); setSaving(false); return }
    } else {
      const { error } = await supabase.from('cal_templates').insert(payload)
      if (error) { alert(error.message); setSaving(false); return }
    }
    setSaving(false); setShowForm(false); setEditing(null); load()
  }

  async function deleteTemplate(id:string) {
    if (!confirm('Delete this template?')) return
    await supabase.from('cal_templates').delete().eq('id', id); load()
  }

  function toleranceLabel(p:Parameter) {
    if (p.tolerance_type==='pct_of_nominal') return `±${p.tolerance}% of nominal`
    return `±${p.tolerance} ${p.tolerance_unit}`
  }

  function nominalLabel(p:Parameter) {
    if (p.nominal_type==='fixed') return `${p.nominal} ${p.unit}`
    return 'From bottle'
  }

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Calibration templates</h1>
          <p className="text-gray-500 text-sm mt-1">Define parameters, test methods and traceability per instrument type</p>
        </div>
        <button onClick={startNew} className="btn-primary">+ Add template</button>
      </div>

      {showForm && (
        <div className="card p-5 mb-5">
          <h2 className="font-semibold text-gray-900 mb-4">{editing?'Edit template':'New template'}</h2>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="col-span-2">
              <label className="label">Template name *</label>
              <input className="input" value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Eurotron Standard Gas Analyser" />
            </div>
            <div className="col-span-2">
              <label className="label">Description</label>
              <input className="input" value={description} onChange={e=>setDescription(e.target.value)} placeholder="Brief description" />
            </div>
            <div className="col-span-2">
              <label className="label">Test method</label>
              <textarea className="input" rows={2} value={testMethod} onChange={e=>setTestMethod(e.target.value)}
                placeholder="e.g. Comparison against certified reference gas standards produced in accordance with ISO 6141" />
              <p className="text-xs text-gray-400 mt-1">This appears above the calibration table on the certificate.</p>
            </div>
          </div>

          {/* Traceability preview */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-4">
            <p className="text-xs font-semibold text-blue-700 mb-1">Traceability statement (fixed on all certificates):</p>
            <p className="text-xs text-blue-600 italic">{TRACEABILITY}</p>
          </div>

          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">Parameters</h3>
            <button onClick={addParam} className="text-xs text-brand-500 hover:underline">+ Add parameter</button>
          </div>

          {params.length===0 && (
            <div className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-3 mb-3">
              No parameters yet — click "+ Add parameter" to add O2, CO2, CH4 etc.
            </div>
          )}

          <div className="space-y-3 mb-4">
            {params.map((p,i)=>(
              <div key={i} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-gray-600">Parameter {i+1}</span>
                  <button onClick={()=>removeParam(i)} className="text-red-400 hover:text-red-600 text-xs">Remove</button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Parameter label</label>
                    <input className="input" value={p.parameter} onChange={e=>updateParam(i,'parameter',e.target.value)} placeholder="e.g. O2 Point 1 (Air)" />
                  </div>
                  <div>
                    <label className="label">Gas</label>
                    <select className="input" value={p.gas} onChange={e=>updateParam(i,'gas',e.target.value)}>
                      {GASES.map(g=><option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Nominal value</label>
                    <select className="input" value={p.nominal_type} onChange={e=>updateParam(i,'nominal_type',e.target.value)}>
                      <option value="fixed">Fixed value</option>
                      <option value="from_bottle">From bottle (auto)</option>
                    </select>
                  </div>
                  {p.nominal_type==='fixed' ? (
                    <>
                      <div><label className="label">Nominal</label><input className="input" value={p.nominal} onChange={e=>updateParam(i,'nominal',e.target.value)} placeholder="e.g. 20.96" /></div>
                      <div>
                        <label className="label">Unit</label>
                        <select className="input" value={p.unit} onChange={e=>updateParam(i,'unit',e.target.value)}>
                          {UNITS.map(u=><option key={u} value={u}>{u}</option>)}
                        </select>
                      </div>
                    </>
                  ) : (
                    <div>
                      <label className="label">Unit</label>
                      <select className="input" value={p.unit} onChange={e=>updateParam(i,'unit',e.target.value)}>
                        <option value="">Auto from bottle</option>
                        {UNITS.map(u=><option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="label">Tolerance type</label>
                    <select className="input" value={p.tolerance_type} onChange={e=>updateParam(i,'tolerance_type',e.target.value as ToleranceType)}>
                      <option value="fixed_abs">Fixed absolute (e.g. ±0.2% vol)</option>
                      <option value="pct_of_nominal">% of nominal (e.g. ±3% of reading)</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Tolerance value</label>
                    <input className="input" value={p.tolerance} onChange={e=>updateParam(i,'tolerance',e.target.value)} placeholder={p.tolerance_type==='pct_of_nominal'?'e.g. 3':'e.g. 0.2'} />
                  </div>
                  {p.tolerance_type==='fixed_abs' && (
                    <div>
                      <label className="label">Tolerance unit</label>
                      <select className="input" value={p.tolerance_unit} onChange={e=>updateParam(i,'tolerance_unit',e.target.value)}>
                        {UNITS.map(u=><option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                  )}
                </div>
                <div className="mt-3 bg-white rounded-lg px-3 py-2 text-xs text-gray-500 border border-gray-100">
                  <span className="font-medium text-gray-700">{p.parameter||'Parameter'}</span>
                  {' '}&mdash; Nominal: <span className="font-mono text-blue-600">{nominalLabel(p)}</span>
                  {' '}&mdash; Tolerance: <span className="font-mono text-green-600">{toleranceLabel(p)}</span>
                  {' '}&mdash; If blank: <span className="font-mono text-gray-400">Not installed</span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button onClick={save} disabled={saving} className="btn-primary">
              {saving?'Saving...':editing?'Update template':'Save template'}
            </button>
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
                  {t.test_method && (
                    <div className="text-xs text-brand-600 mt-1">
                      <span className="font-medium">Test method:</span> {t.test_method}
                    </div>
                  )}
                  <div className="text-xs text-gray-400 mt-1 italic">{TRACEABILITY.slice(0,80)}...</div>
                </div>
                <div className="flex gap-3 shrink-0 ml-4">
                  <button onClick={()=>startEdit(t)} className="text-xs text-brand-500 hover:underline">Edit</button>
                  <button onClick={()=>deleteTemplate(t.id)} className="text-xs text-red-400 hover:underline">Delete</button>
                </div>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-50 text-gray-400 uppercase tracking-wider bg-gray-50">
                    <th className="px-5 py-2 text-left">Parameter</th>
                    <th className="px-5 py-2 text-left">Gas</th>
                    <th className="px-5 py-2 text-left">Nominal</th>
                    <th className="px-5 py-2 text-left">Tolerance</th>
                    <th className="px-5 py-2 text-left">If blank</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {(t.parameters||[]).map((p:Parameter,i:number)=>(
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-5 py-2 font-medium text-gray-800">{p.parameter}</td>
                      <td className="px-5 py-2"><span className="badge-info">{p.gas}</span></td>
                      <td className="px-5 py-2 font-mono text-blue-600">{nominalLabel(p)}</td>
                      <td className="px-5 py-2 font-mono text-green-600">{toleranceLabel(p)}</td>
                      <td className="px-5 py-2 text-gray-400 italic">Not installed</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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