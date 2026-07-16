'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const UNITS = ['bar', 'mbar', 'psi', 'kPa', 'MPa', 'inH2O', 'mmHg']
const CONNECTIONS = ['1/4" BSP MALE', '1/4" BSP FEMALE', '1/2" BSP MALE', '1/2" BSP FEMALE', '1/4" NPT MALE', '1/2" NPT MALE', 'Other']
const GAUGE_TYPES = ['Gauge', 'Absolute', 'Differential', 'Compound']
const MEDIA_TYPES = ['Air', 'Oil', 'Water', 'Nitrogen', 'Other']

interface Reading {
  id: string
  applied_pressure: string
  reading_up: string
  reading_down: string
}

function uid() { return Math.random().toString(36).slice(2) }

export default function NewPressureCertPage() {
  const router = useRouter()
  const supabase = createClient()

  const [customers, setCustomers] = useState<any[]>([])
  const [refStandards, setRefStandards] = useState<any[]>([])
  const [selectedRefId, setSelectedRefId] = useState('')
  const [profile, setProfile]     = useState<any>(null)
  const [saving, setSaving]       = useState(false)
  const [activeSection, setActiveSection] = useState(0)

  // UUT fields
  const [customerId, setCustomerId] = useState('')
  const [manufacturer, setManufacturer] = useState('Eurotron Instruments UK Ltd')
  const [model, setModel]           = useState('')
  const [serialNumber, setSerialNumber] = useState('')
  const [accuracyPctFs, setAccuracyPctFs] = useState('0.05')
  const [pressureRange, setPressureRange] = useState('')
  const [vacuumRange, setVacuumRange] = useState('')
  const [pressureUnit, setPressureUnit] = useState('bar')
  const [gaugeType, setGaugeType]   = useState('Gauge')
  const [connection, setConnection] = useState('1/2" BSP FEMALE')
  const [calDate, setCalDate]       = useState(new Date().toISOString().split('T')[0])

  // Conditions
  const [tempC, setTempC]           = useState('23')
  const [procedure, setProcedure]   = useState('IS-09-07-01')
  const [media, setMedia]           = useState('Air')
  const [orientation, setOrientation] = useState('Vertical Position')
  const [zeroedBefore, setZeroedBefore] = useState(true)
  const [notes, setNotes]           = useState('')

  // Reference standard
  const [refModel, setRefModel]     = useState('PACE 5000')
  const [refSerial, setRefSerial]   = useState('11180394')
  const [refRange, setRefRange]     = useState('-1 to 70 bar g')
  const [refUkas, setRefUkas]       = useState('133851')

  // Readings
  const [readings, setReadings]     = useState<Reading[]>([
    { id: uid(), applied_pressure: '', reading_up: '', reading_down: '' }
  ])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      const [{ data: prof }, { data: custs }, { data: refs }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user!.id).single(),
        supabase.from('customers').select('id,name').order('name'),
        supabase.from('reference_standards').select('*').eq('active', true).order('description'),
      ])
      setProfile(prof)
      setCustomers(custs||[])
      setRefStandards(refs||[])
    }
    load()
  }, [])

  function handleRefChange(refId: string) {
    setSelectedRefId(refId)
    const ref = refStandards.find((r: any) => r.id === refId)
    if (ref) {
      setRefModel(ref.description || '')
      setRefSerial(ref.serial_number || '')
      setRefRange(ref.notes || '-1 to 70 bar g')
      setRefUkas(ref.certificate_no || '')
    }
  }

  function generateDefaultPoints() {
    const range = parseFloat(pressureRange)
    const vac = parseFloat(vacuumRange) || 0
    if (isNaN(range)) return alert('Please enter a pressure range first.')
    const points = []
    if (vac < 0) points.push(vac)
    points.push(0)
    points.push(range * 0.25)
    points.push(range * 0.50)
    points.push(range * 0.75)
    points.push(range)
    // Down
    points.push(range * 0.75)
    points.push(range * 0.50)
    points.push(range * 0.25)
    points.push(0)
    if (vac < 0) points.push(vac)
    setReadings(points.map(p => ({ id: uid(), applied_pressure: String(parseFloat(p.toFixed(4))), reading_up: '', reading_down: '' })))
  }

  function addReading() {
    setReadings(r => [...r, { id: uid(), applied_pressure: '', reading_up: '', reading_down: '' }])
  }

  function removeReading(id: string) {
    setReadings(r => r.filter(row => row.id !== id))
  }

  function updateReading(id: string, field: string, val: string) {
    setReadings(r => r.map(row => row.id === id ? { ...row, [field]: val } : row))
  }

  function calcError(applied: string, reading: string): { error: string; errorPct: string; result: string } {
    const a = parseFloat(applied)
    const r = parseFloat(reading)
    const acc = parseFloat(accuracyPctFs)
    const range = parseFloat(pressureRange)
    if (isNaN(a) || isNaN(r) || isNaN(acc) || isNaN(range)) return { error: '', errorPct: '', result: '' }
    const err = r - a
    const errPct = (err / range) * 100
    const tol = acc * range / 100
    const result = Math.abs(err) <= tol ? 'PASS' : 'FAIL'
    return {
      error: parseFloat(err.toFixed(6)).toString(),
      errorPct: parseFloat(errPct.toFixed(6)).toString(),
      result
    }
  }

  function overallResult(): 'pass' | 'fail' | 'na' {
    const results: string[] = []
    readings.forEach(r => {
      if (r.reading_up) results.push(calcError(r.applied_pressure, r.reading_up).result)
      if (r.reading_down) results.push(calcError(r.applied_pressure, r.reading_down).result)
    })
    if (!results.length) return 'na'
    return results.some(r => r === 'FAIL') ? 'fail' : 'pass'
  }

  async function handleSave(saveAsDraft = false) {
    if (!customerId) return alert('Please select a customer.')
    if (!serialNumber) return alert('Please enter a serial number.')
    if (!pressureRange) return alert('Please enter a pressure range.')
    setSaving(true)

    const { data: cert, error } = await supabase.from('pressure_certificates').insert({
      customer_id: customerId,
      calibration_date: calDate,
      visit_date: calDate,
      manufacturer, model, serial_number: serialNumber,
      accuracy_pct_fs: parseFloat(accuracyPctFs),
      pressure_range: parseFloat(pressureRange),
      vacuum_range: vacuumRange ? parseFloat(vacuumRange) : null,
      pressure_unit: pressureUnit,
      gauge_type: gaugeType,
      pressure_connection: connection,
      temperature_c: parseFloat(tempC) || 23,
      calibration_procedure: procedure,
      media, orientation,
      zeroed_before_cal: zeroedBefore,
      notes: notes || null,
      ref_model: refModel, ref_serial: refSerial,
      ref_range: refRange, ref_ukas_cert: refUkas,
      engineer_id: profile?.id,
      overall_result: overallResult(),
      status: saveAsDraft ? 'draft' : 'complete',
    }).select().single()

    if (error || !cert) { alert(error?.message); setSaving(false); return }

    const readingInserts = readings
      .filter(r => r.applied_pressure !== '')
      .map((r, i) => ({
        cert_id: cert.id,
        sort_order: i,
        applied_pressure: parseFloat(r.applied_pressure),
        reading_up: r.reading_up ? parseFloat(r.reading_up) : null,
        reading_down: r.reading_down ? parseFloat(r.reading_down) : null,
      }))

    if (readingInserts.length) {
      await supabase.from('pressure_cal_readings').insert(readingInserts)
    }

    setSaving(false)
    router.push(`/dashboard/pressure/${cert.id}`)
  }

  const sections = ['Customer & unit', 'Test conditions', 'Reference standard', 'Calibration readings', 'Complete']
  const overall = overallResult()
  const toleranceBar = pressureRange && accuracyPctFs
    ? parseFloat((parseFloat(accuracyPctFs) * parseFloat(pressureRange) / 100).toFixed(4))
    : null

  return (
    <div className="p-4 max-w-2xl mx-auto pb-32">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">New pressure certificate</h1>
          <p className="text-gray-400 text-xs mt-0.5">Eurotron Instruments UK Ltd</p>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-400">Overall result</div>
          <span className={`text-sm font-bold ${overall === 'pass' ? 'text-green-600' : overall === 'fail' ? 'text-red-600' : 'text-gray-400'}`}>
            {overall === 'pass' ? 'PASS' : overall === 'fail' ? 'FAIL' : '-'}
          </span>
        </div>
      </div>

      {/* Step tabs */}
      <div className="flex gap-1.5 mb-6 overflow-x-auto pb-1">
        {sections.map((s, i) => (
          <button key={i} onClick={() => setActiveSection(i)}
            className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${activeSection === i ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
            {i + 1}. {s.split(' ')[0]}
          </button>
        ))}
      </div>

      {/* Section 0: Customer & unit */}
      {activeSection === 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-gray-800 text-sm">Unit under test (UUT)</h2>
          <div>
            <label className="label">Customer *</label>
            <select className="input" value={customerId} onChange={e=>setCustomerId(e.target.value)}>
              <option value="">Select customer...</option>
              {customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div><label className="label">Manufacturer</label><input className="input" value={manufacturer} onChange={e=>setManufacturer(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Model *</label><input className="input" value={model} onChange={e=>setModel(e.target.value)} placeholder="e.g. P100NEW 20G" /></div>
            <div><label className="label">Serial number *</label><input className="input" value={serialNumber} onChange={e=>setSerialNumber(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Accuracy (%FS)</label><input className="input" type="number" step="0.001" value={accuracyPctFs} onChange={e=>setAccuracyPctFs(e.target.value)} /></div>
            <div>
              <label className="label">Pressure unit</label>
              <select className="input" value={pressureUnit} onChange={e=>setPressureUnit(e.target.value)}>
                {UNITS.map(u=><option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Pressure range ({pressureUnit}) *</label><input className="input" type="number" step="any" value={pressureRange} onChange={e=>setPressureRange(e.target.value)} placeholder="e.g. 20" /></div>
            <div><label className="label">Vacuum range ({pressureUnit})</label><input className="input" type="number" step="any" value={vacuumRange} onChange={e=>setVacuumRange(e.target.value)} placeholder="e.g. -0.8" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Gauge type</label>
              <select className="input" value={gaugeType} onChange={e=>setGaugeType(e.target.value)}>
                {GAUGE_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Pressure connection</label>
              <select className="input" value={connection} onChange={e=>setConnection(e.target.value)}>
                {CONNECTIONS.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div><label className="label">Calibration date</label><input className="input" type="date" value={calDate} onChange={e=>setCalDate(e.target.value)} /></div>
          {pressureRange && accuracyPctFs && (
            <div className="bg-brand-50 rounded-xl p-3 text-xs space-y-1">
              <div className="flex justify-between"><span className="text-gray-500">Tolerance (±bar)</span><span className="font-mono font-semibold text-brand-700">±{toleranceBar} {pressureUnit}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Tolerance (%FS)</span><span className="font-mono font-semibold text-brand-700">±{accuracyPctFs}%</span></div>
            </div>
          )}
        </div>
      )}

      {/* Section 1: Test conditions */}
      {activeSection === 1 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-gray-800 text-sm">Test conditions</h2>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Temperature (°C)</label><input className="input" type="number" value={tempC} onChange={e=>setTempC(e.target.value)} /></div>
            <div>
              <label className="label">Media</label>
              <select className="input" value={media} onChange={e=>setMedia(e.target.value)}>
                {MEDIA_TYPES.map(m=><option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <div><label className="label">Calibration procedure</label><input className="input" value={procedure} onChange={e=>setProcedure(e.target.value)} /></div>
          <div><label className="label">Orientation</label><input className="input" value={orientation} onChange={e=>setOrientation(e.target.value)} /></div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={zeroedBefore} onChange={e=>setZeroedBefore(e.target.checked)} className="w-4 h-4 rounded" />
            <span className="text-sm text-gray-700">Unit was zeroed before calibration</span>
          </label>
          <div><label className="label">Notes</label><textarea className="input" rows={3} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Any additional notes..." /></div>
        </div>
      )}

      {/* Section 2: Reference standard */}
      {activeSection === 2 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-gray-800 text-sm">Reference standard</h2>
          <div>
            <label className="label">Select from library</label>
            <select className="input" value={selectedRefId} onChange={e=>handleRefChange(e.target.value)}>
              <option value="">Select reference standard...</option>
              {refStandards.map((r: any) => (
                <option key={r.id} value={r.id}>{r.description} (S/N: {r.serial_number})</option>
              ))}
            </select>
          </div>
          {selectedRefId && (
            <div className="bg-brand-50 rounded-xl p-3 text-xs space-y-1">
              <div className="flex justify-between"><span className="text-gray-500">Model</span><span className="font-medium">{refModel}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Serial number</span><span className="font-mono font-medium">{refSerial}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">UKAS cert</span><span className="font-medium">{refUkas}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Cal due</span><span className="font-medium text-amber-600">
                {refStandards.find((r:any) => r.id === selectedRefId)?.cal_due_date || '—'}
              </span></div>
            </div>
          )}
          <p className="text-xs text-gray-400">Or enter manually if not in library:</p>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Model</label><input className="input" value={refModel} onChange={e=>setRefModel(e.target.value)} /></div>
            <div><label className="label">Serial number</label><input className="input" value={refSerial} onChange={e=>setRefSerial(e.target.value)} /></div>
          </div>
          <div><label className="label">Range</label><input className="input" value={refRange} onChange={e=>setRefRange(e.target.value)} /></div>
          <div><label className="label">UKAS Certificate number</label><input className="input" value={refUkas} onChange={e=>setRefUkas(e.target.value)} /></div>
        </div>
      )}

      {/* Section 3: Calibration readings */}
      {activeSection === 3 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-800 text-sm">Calibration readings</h2>
              <p className="text-xs text-gray-400 mt-0.5">Enter applied pressure and UUT readings up and down.</p>
            </div>
            <button onClick={generateDefaultPoints} className="btn-secondary text-xs py-1.5">Auto-generate points</button>
          </div>

          {toleranceBar && (
            <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-2 text-xs text-green-700">
              Tolerance: ±{toleranceBar} {pressureUnit} (±{accuracyPctFs}% FS of {pressureRange} {pressureUnit})
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase tracking-wider">
                  <th className="px-2 py-2 text-left">Applied ({pressureUnit})</th>
                  <th className="px-2 py-2 text-left">Reading Up</th>
                  <th className="px-2 py-2 text-left">Error Up</th>
                  <th className="px-2 py-2 text-left">Reading Down</th>
                  <th className="px-2 py-2 text-left">Error Down</th>
                  <th className="px-2 py-2 text-left">Result</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {readings.map(row => {
                  const upCalc = calcError(row.applied_pressure, row.reading_up)
                  const downCalc = calcError(row.applied_pressure, row.reading_down)
                  const rowResult = !upCalc.result && !downCalc.result ? '' :
                    upCalc.result === 'FAIL' || downCalc.result === 'FAIL' ? 'FAIL' : 'PASS'
                  return (
                    <tr key={row.id}>
                      <td className="px-2 py-1.5">
                        <input type="number" step="any" className="w-full border border-gray-200 rounded px-1.5 py-1 text-xs" value={row.applied_pressure}
                          onChange={e=>updateReading(row.id,'applied_pressure',e.target.value)} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="number" step="any" className="w-full border border-gray-200 rounded px-1.5 py-1 text-xs" value={row.reading_up}
                          onChange={e=>updateReading(row.id,'reading_up',e.target.value)} />
                      </td>
                      <td className="px-2 py-1.5 font-mono text-gray-500">{upCalc.error || '—'}</td>
                      <td className="px-2 py-1.5">
                        <input type="number" step="any" className="w-full border border-gray-200 rounded px-1.5 py-1 text-xs" value={row.reading_down}
                          onChange={e=>updateReading(row.id,'reading_down',e.target.value)} />
                      </td>
                      <td className="px-2 py-1.5 font-mono text-gray-500">{downCalc.error || '—'}</td>
                      <td className="px-2 py-1.5">
                        {rowResult === 'PASS' ? <span className="px-1.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">PASS</span>
                         : rowResult === 'FAIL' ? <span className="px-1.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">FAIL</span>
                         : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-2 py-1.5">
                        <button onClick={()=>removeReading(row.id)} className="text-gray-300 hover:text-red-400">x</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <button onClick={addReading} className="text-xs text-brand-500 hover:underline">+ Add row</button>

          {overall !== 'na' && (
            <div className={`rounded-xl px-4 py-3 text-sm font-medium text-center ${overall === 'pass' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {overall === 'pass' ? 'Overall result: PASS ✓' : 'Overall result: FAIL ✗'}
            </div>
          )}
        </div>
      )}

      {/* Section 4: Complete */}
      {activeSection === 4 && (
        <div className="space-y-4">
          <h2 className="font-semibold text-gray-800 text-sm">Complete certificate</h2>
          <div className="card p-4 space-y-2 text-xs">
            <div className="flex justify-between"><span className="text-gray-500">Customer</span><span className="font-medium">{customers.find(c=>c.id===customerId)?.name??'—'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Model</span><span className="font-medium">{model||'—'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Serial number</span><span className="font-medium font-mono">{serialNumber||'—'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Range</span><span className="font-medium">{vacuumRange ? vacuumRange + ' to ' : '0 to '}{pressureRange} {pressureUnit}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Accuracy</span><span className="font-medium">±{accuracyPctFs}% FS (±{toleranceBar} {pressureUnit})</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Test points</span><span className="font-medium">{readings.filter(r=>r.applied_pressure).length} points</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Overall result</span>
              <span className={`font-bold ${overall === 'pass' ? 'text-green-600' : overall === 'fail' ? 'text-red-600' : 'text-gray-400'}`}>
                {overall === 'pass' ? 'PASS ✓' : overall === 'fail' ? 'FAIL ✗' : '—'}
              </span>
            </div>
          </div>
          <div className="space-y-2 pt-2">
            <button onClick={() => handleSave(true)} disabled={saving}
              className="w-full py-3 rounded-xl border-2 border-amber-400 bg-amber-50 hover:bg-amber-100 text-amber-700 font-semibold text-sm transition-colors disabled:opacity-50">
              {saving ? 'Saving...' : '💾 Save as draft'}
            </button>
            <button onClick={() => handleSave(false)} disabled={saving}
              className="w-full py-3 rounded-xl bg-brand-500 hover:bg-brand-700 text-white font-semibold text-sm transition-colors disabled:opacity-50">
              {saving ? 'Saving...' : '✓ Complete & generate certificate'}
            </button>
          </div>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-3 flex gap-3">
        {activeSection > 0 && <button onClick={() => setActiveSection(s => s - 1)} className="btn-secondary flex-1">Back</button>}
        {activeSection < sections.length - 1 && <button onClick={() => setActiveSection(s => s + 1)} className="btn-primary flex-1">Next</button>}
      </div>
    </div>
  )
}
