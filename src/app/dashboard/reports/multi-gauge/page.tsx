'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface GaugeSlot {
  uid: string
  instrumentId: string
  instrument: any | null
  readings: string[]
}

interface PressureRow {
  applied: string
}

function uid() { return Math.random().toString(36).slice(2) }

export default function MultiGaugeSessionPage() {
  const router = useRouter()
  const supabase = createClient()

  const [instruments, setInstruments] = useState<any[]>([])
  const [standards, setStandards]     = useState<any[]>([])
  const [profile, setProfile]         = useState<any>(null)
  const [numGauges, setNumGauges]     = useState(2)
  const [gauges, setGauges]           = useState<GaugeSlot[]>([
    { uid: uid(), instrumentId: '', instrument: null, readings: [] },
    { uid: uid(), instrumentId: '', instrument: null, readings: [] },
  ])
  const [pressureRows, setPressureRows] = useState<PressureRow[]>([])
  const [refStandardId, setRefStandardId] = useState('')
  const [calDate, setCalDate]         = useState(new Date().toISOString().split('T')[0])
  const [tempC, setTempC]             = useState('23')
  const [media, setMedia]             = useState('Air')
  const [orientation, setOrientation] = useState('Vertical Position')
  const [procedure, setProcedure]     = useState('IS-09-07-01')
  const [zeroedBefore, setZeroedBefore] = useState(true)
  const [basisOfTolerance, setBasisOfTolerance] = useState('Manufacturer Specification')
  const [sageNumber, setSageNumber]   = useState('')
  const [activeSection, setActiveSection] = useState(0)
  const [saving, setSaving]           = useState(false)
  const [saveMsg, setSaveMsg]         = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      const [{ data: prof }, { data: insts }, { data: stds }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user!.id).single(),
        supabase.from('instruments')
          .select('*, customer:customers(*), site:sites(*)')
          .eq('status', 'active')
          .eq('instrument_category', 'pressure_gauge')
          .order('name'),
        supabase.from('reference_standards').select('*').eq('active', true).order('description'),
      ])
      setProfile(prof)
      setInstruments(insts || [])
      setStandards((stds || []).filter((s: any) => s.standard_types?.includes('pressure')))
    }
    load()
  }, [])

  function handleNumGauges(n: number) {
    setNumGauges(n)
    const current = [...gauges]
    while (current.length < n) current.push({ uid: uid(), instrumentId: '', instrument: null, readings: pressureRows.map(() => '') })
    setGauges(current.slice(0, n))
  }

  function handleGaugeSelect(slotUid: string, instrumentId: string) {
    const inst = instruments.find(i => i.id === instrumentId) || null
    setGauges(prev => prev.map(g => g.uid === slotUid ? { ...g, instrumentId, instrument: inst } : g))

    // If first gauge selected, auto-generate pressure points
    const isFirst = gauges[0].uid === slotUid
    if (isFirst && inst && pressureRows.length === 0) {
      generatePoints(inst)
    }
  }

  function generatePoints(inst: any) {
    const range = parseFloat(inst.pressure_range) || 0
    const vac = parseFloat(inst.vacuum_range) || 0
    const dp = inst.decimal_places || 2
    const points: number[] = []
    if (vac < 0) points.push(vac)
    points.push(0)
    points.push(parseFloat((range * 0.25).toFixed(dp)))
    points.push(parseFloat((range * 0.50).toFixed(dp)))
    points.push(parseFloat((range * 0.75).toFixed(dp)))
    points.push(range)
    points.push(parseFloat((range * 0.75).toFixed(dp)))
    points.push(parseFloat((range * 0.50).toFixed(dp)))
    points.push(parseFloat((range * 0.25).toFixed(dp)))
    points.push(0)
    if (vac < 0) points.push(vac)
    const rows = points.map(p => ({ applied: p.toFixed(dp) }))
    setPressureRows(rows)
    setGauges(prev => prev.map(g => ({ ...g, readings: rows.map(() => '') })))
  }

  function updateReading(slotUid: string, rowIdx: number, val: string) {
    setGauges(prev => prev.map(g => {
      if (g.uid !== slotUid) return g
      const readings = [...g.readings]
      readings[rowIdx] = val
      return { ...g, readings }
    }))
  }

  function calcError(applied: string, reading: string, inst: any) {
    if (!reading || !inst) return { error: '', errorPct: '', errorPctTol: '', result: '' }
    const a = parseFloat(applied)
    const r = parseFloat(reading)
    const range = parseFloat(inst.pressure_range)
    const acc = parseFloat(inst.accuracy_pct_fs)
    const dp = inst.decimal_places || 2
    if (isNaN(a) || isNaN(r)) return { error: '', errorPct: '', errorPctTol: '', result: '' }
    const err = r - a
    const errPct = (err / range) * 100
    const tol = acc * range / 100
    const errPctTol = tol > 0 ? (Math.abs(err) / tol) * 100 : 0
    return {
      error: parseFloat(err.toFixed(dp + 2)).toString(),
      errorPct: parseFloat(errPct.toFixed(4)).toString(),
      errorPctTol: Math.round(errPctTol).toString(),
      result: Math.abs(err) <= tol ? 'PASS' : 'FAIL'
    }
  }

  function gaugeOverallResult(gauge: GaugeSlot): 'pass' | 'fail' | 'na' {
    if (!gauge.instrument) return 'na'
    const results = gauge.readings
      .map((r, i) => calcError(pressureRows[i]?.applied || '', r, gauge.instrument).result)
      .filter(r => r === 'PASS' || r === 'FAIL')
    if (!results.length) return 'na'
    return results.some(r => r === 'FAIL') ? 'fail' : 'pass'
  }

  function autoRound(val: string, dp: number): string {
    const n = parseFloat(val)
    if (isNaN(n)) return val
    return n.toFixed(dp)
  }

  async function handleSave() {
    const validGauges = gauges.filter(g => g.instrument)
    if (validGauges.length === 0) { alert('Please select at least one gauge.'); return }
    if (!refStandardId) { alert('Please select a reference standard.'); return }
    if (pressureRows.length === 0) { alert('Please add calibration readings.'); return }

    setSaving(true)
    const generatedIds: string[] = []

    for (const gauge of validGauges) {
      setSaveMsg(`Saving certificate for ${gauge.instrument.serial_number}...`)
      const overall = gaugeOverallResult(gauge)
      const expiry = new Date(calDate)
      expiry.setMonth(expiry.getMonth() + (gauge.instrument.cal_interval_months || 12))

      const { data: report, error } = await supabase.from('service_reports').insert({
        instrument_id: gauge.instrumentId,
        customer_id: gauge.instrument.customer?.id,
        engineer_id: profile?.id,
        visit_date: calDate,
        site_location: gauge.instrument.site?.name || null,
        report_type: 'pressure_cal',
        overall_result: overall,
        sage_number: sageNumber || null,
        cert_expiry_date: expiry.toISOString().split('T')[0],
        pressure_media: media,
        pressure_temperature: parseFloat(tempC),
        pressure_orientation: orientation,
        pressure_procedure: procedure,
        zeroed_before_cal: zeroedBefore,
        status: 'complete',
      }).select().single()

      if (error || !report) { alert('Error: ' + error?.message); setSaving(false); return }
      generatedIds.push(report.id)

      // Save readings
      const readingInserts = pressureRows
        .filter(r => r.applied !== '')
        .map((r, i) => ({
          report_id: report.id,
          instrument_id: gauge.instrumentId,
          serial_number: gauge.instrument.serial_number,
          sort_order: i,
          applied_pressure: parseFloat(r.applied),
          reading: gauge.readings[i] ? parseFloat(gauge.readings[i]) : null,
          phase: 'after_adjustment',
        }))
      if (readingInserts.length) await supabase.from('pressure_readings').insert(readingInserts)

      // Save reference standard
      const ref = standards.find(s => s.id === refStandardId)
      if (ref) await supabase.from('report_standards').insert({
        report_id: report.id, standard_id: refStandardId,
        description: ref.description, serial_number: ref.serial_number,
        certificate_no: ref.certificate_no, cal_due_date: ref.cal_due_date
      })

      // Update instrument
      await supabase.from('instruments').update({
        last_cal_date: calDate,
        last_service_date: calDate,
        next_cal_date: expiry.toISOString().split('T')[0],
      }).eq('id', gauge.instrumentId)
    }

    setSaving(false)
    setSaveMsg(`${validGauges.length} certificates generated!`)
    // Redirect to reports list
    setTimeout(() => router.push('/dashboard/reports'), 1500)
  }

  const sections = ['Setup', 'Conditions & Reference', 'Readings', 'Complete']
  const pressureStandards = standards
  const firstInst = gauges.find(g => g.instrument)?.instrument

  return (
    <div className="p-4 max-w-4xl mx-auto pb-32">
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="text-xs text-gray-400 mb-1">
            <a href="/dashboard/reports" className="hover:text-brand-500">Reports</a> / Multi-gauge session
          </div>
          <h1 className="text-xl font-semibold text-gray-900">Multi-gauge calibration session</h1>
          <p className="text-gray-400 text-xs mt-0.5">Calibrate up to 3 gauges simultaneously — generates separate certificates</p>
        </div>
      </div>

      {/* Step tabs */}
      <div className="flex gap-1.5 mb-6 overflow-x-auto pb-1">
        {sections.map((s, i) => (
          <button key={i} onClick={() => setActiveSection(i)}
            className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${activeSection === i ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
            {i + 1}. {s}
          </button>
        ))}
      </div>

      {/* SECTION 0: Setup */}
      {activeSection === 0 && (
        <div className="space-y-4">
          <h2 className="font-semibold text-gray-800 text-sm">Session setup</h2>

          {/* Number of gauges */}
          <div>
            <label className="label">Number of gauges on rig</label>
            <div className="flex gap-2">
              {[1,2,3].map(n => (
                <button key={n} onClick={() => handleNumGauges(n)}
                  className={`flex-1 py-3 rounded-xl border-2 text-sm font-semibold transition-colors ${numGauges === n ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-500'}`}>
                  {n} {n === 1 ? 'gauge' : 'gauges'}
                </button>
              ))}
            </div>
          </div>

          {/* Gauge slots */}
          <div className="space-y-3">
            {gauges.slice(0, numGauges).map((gauge, idx) => (
              <div key={gauge.uid} className="card p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  Gauge {idx + 1}
                  {gauge.instrument && (
                    <span className="ml-2 text-xs text-gray-400 font-normal">
                      S/N: {gauge.instrument.serial_number} · {gauge.instrument.customer?.name}
                    </span>
                  )}
                </h3>
                <select className="input" value={gauge.instrumentId}
                  onChange={e => handleGaugeSelect(gauge.uid, e.target.value)}>
                  <option value="">Select pressure gauge...</option>
                  {instruments.map(i => (
                    <option key={i.id} value={i.id}>
                      {i.name} — {i.customer?.name} (S/N: {i.serial_number ?? 'N/A'}) — {i.pressure_range} {i.pressure_unit}
                    </option>
                  ))}
                </select>
                {gauge.instrument && (
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                    <div className="bg-brand-50 rounded-lg p-2">
                      <div className="text-gray-400">Range</div>
                      <div className="font-mono font-semibold">{gauge.instrument.vacuum_range ? gauge.instrument.vacuum_range + ' to ' : '0 to '}{gauge.instrument.pressure_range} {gauge.instrument.pressure_unit}</div>
                    </div>
                    <div className="bg-brand-50 rounded-lg p-2">
                      <div className="text-gray-400">Accuracy</div>
                      <div className="font-mono font-semibold">±{gauge.instrument.accuracy_pct_fs}% FS</div>
                    </div>
                    <div className="bg-brand-50 rounded-lg p-2">
                      <div className="text-gray-400">Resolution</div>
                      <div className="font-mono font-semibold">{Math.pow(10, -gauge.instrument.decimal_places).toFixed(gauge.instrument.decimal_places)} {gauge.instrument.pressure_unit}</div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Calibration date</label><input className="input" type="date" value={calDate} onChange={e => setCalDate(e.target.value)} /></div>
            <div><label className="label">Sage sales number</label><input className="input" value={sageNumber} onChange={e => setSageNumber(e.target.value)} placeholder="e.g. SO-12345" /></div>
          </div>
        </div>
      )}

      {/* SECTION 1: Conditions & Reference */}
      {activeSection === 1 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-gray-800 text-sm">Test conditions & reference standard</h2>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Temperature (°C)</label><input className="input" type="number" value={tempC} onChange={e => setTempC(e.target.value)} /></div>
            <div>
              <label className="label">Media</label>
              <select className="input" value={media} onChange={e => setMedia(e.target.value)}>
                {['Air','Oil','Water','Nitrogen','Other'].map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <div><label className="label">Procedure</label><input className="input" value={procedure} onChange={e => setProcedure(e.target.value)} /></div>
          <div><label className="label">Orientation</label><input className="input" value={orientation} onChange={e => setOrientation(e.target.value)} /></div>
          <div>
            <label className="label">Basis of tolerance</label>
            <select className="input" value={basisOfTolerance} onChange={e => setBasisOfTolerance(e.target.value)}>
              <option>Manufacturer Specification</option>
              <option>BSEN 837-1</option>
              <option>BSEN 837-2</option>
              <option>BSEN 837-3</option>
              <option>Customer Specification</option>
            </select>
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={zeroedBefore} onChange={e => setZeroedBefore(e.target.checked)} className="w-4 h-4 rounded" />
            <span className="text-sm text-gray-700">Units were zeroed before calibration</span>
          </label>

          <div className="mt-2">
            <label className="label">Reference standard *</label>
            {pressureStandards.length === 0 ? (
              <div className="bg-amber-50 rounded-xl p-3 text-sm text-amber-700">
                No pressure reference standards found. Go to <a href="/dashboard/admin/standards" className="underline">Admin → Ref Standards</a>.
              </div>
            ) : (
              <select className={`input ${!refStandardId ? 'border-amber-300 bg-amber-50' : ''}`} value={refStandardId} onChange={e => setRefStandardId(e.target.value)}>
                <option value="">⚠ Select reference standard...</option>
                {pressureStandards.map((s: any) => <option key={s.id} value={s.id}>{s.description} (S/N: {s.serial_number})</option>)}
              </select>
            )}
            {refStandardId && (() => {
              const ref = pressureStandards.find((s: any) => s.id === refStandardId)
              return ref ? (
                <div className="mt-2 bg-brand-50 rounded-xl p-3 text-xs space-y-1">
                  <div className="flex justify-between"><span className="text-gray-500">Serial number</span><span className="font-mono font-medium">{ref.serial_number}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Certificate no.</span><span className="font-medium">{ref.certificate_no}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Cal due</span>
                    <span className={`font-medium ${ref.cal_due_date && new Date(ref.cal_due_date) < new Date() ? 'text-red-600 font-bold' : 'text-gray-700'}`}>
                      {ref.cal_due_date || '—'}
                      {ref.cal_due_date && new Date(ref.cal_due_date) < new Date() && ' ⚠ OVERDUE!'}
                    </span>
                  </div>
                </div>
              ) : null
            })()}
          </div>
        </div>
      )}

      {/* SECTION 2: Readings */}
      {activeSection === 2 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-800 text-sm">Calibration readings</h2>
              <p className="text-xs text-gray-400 mt-0.5">Enter readings for each gauge at each applied pressure point.</p>
            </div>
            {firstInst && (
              <button onClick={() => generatePoints(firstInst)} className="btn-secondary text-xs py-1.5">↺ Reset points</button>
            )}
          </div>

          {firstInst && (
            <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-2 text-xs text-green-700">
              Tolerance: ±{firstInst.accuracy_pct_fs}% FS = ±{(firstInst.accuracy_pct_fs * firstInst.pressure_range / 100).toFixed(firstInst.decimal_places)} {firstInst.pressure_unit}
            </div>
          )}

          {pressureRows.length === 0 ? (
            <div className="bg-amber-50 rounded-xl p-4 text-sm text-amber-700">
              Please select Gauge 1 first — test points will auto-generate based on its range.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase">
                    <th className="px-3 py-2 text-left sticky left-0 bg-gray-50">Applied ({firstInst?.pressure_unit})</th>
                    {gauges.slice(0, numGauges).map((gauge, idx) => (
                      <th key={gauge.uid} className="px-3 py-2 text-left" colSpan={2}>
                        <div>Gauge {idx + 1}</div>
                        {gauge.instrument && <div className="text-gray-400 font-normal normal-case">S/N: {gauge.instrument.serial_number}</div>}
                      </th>
                    ))}
                  </tr>
                  <tr className="bg-gray-50 border-b border-gray-100 text-gray-400 text-xs">
                    <th className="px-3 py-1 sticky left-0 bg-gray-50"></th>
                    {gauges.slice(0, numGauges).map(gauge => (
                      <>
                        <th key={gauge.uid + 'r'} className="px-3 py-1 text-left">Reading</th>
                        <th key={gauge.uid + 'e'} className="px-3 py-1 text-left">Result</th>
                      </>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pressureRows.map((row, rowIdx) => (
                    <tr key={rowIdx}>
                      <td className="px-3 py-1.5 font-mono font-semibold sticky left-0 bg-white border-r border-gray-100">
                        {row.applied}
                      </td>
                      {gauges.slice(0, numGauges).map((gauge, gIdx) => {
                        const reading = gauge.readings[rowIdx] || ''
                        const calc = gauge.instrument ? calcError(row.applied, reading, gauge.instrument) : { result: '' }
                        const dp = gauge.instrument?.decimal_places || 2
                        return (
                          <>
                            <td key={gauge.uid + 'r' + rowIdx} className="px-2 py-1.5">
                              <input type="number" step="any"
                                className="w-24 border border-gray-200 rounded px-1.5 py-1 text-xs"
                                defaultValue={reading}
                                placeholder={row.applied}
                                onBlur={e => updateReading(gauge.uid, rowIdx, autoRound(e.target.value, dp))} />
                            </td>
                            <td key={gauge.uid + 'e' + rowIdx} className="px-2 py-1.5">
                              {calc.result === 'PASS' ? <span className="text-xs font-bold text-green-600">PASS</span>
                               : calc.result === 'FAIL' ? <span className="text-xs font-bold text-red-600">FAIL</span>
                               : <span className="text-gray-300">—</span>}
                            </td>
                          </>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Overall results per gauge */}
          {pressureRows.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {gauges.slice(0, numGauges).map((gauge, idx) => {
                const result = gaugeOverallResult(gauge)
                return (
                  <div key={gauge.uid} className={`rounded-xl p-3 text-center text-xs font-semibold ${result === 'pass' ? 'bg-green-50 text-green-700' : result === 'fail' ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-400'}`}>
                    <div>Gauge {idx + 1}</div>
                    {gauge.instrument && <div className="font-mono text-xs opacity-70">S/N: {gauge.instrument.serial_number}</div>}
                    <div className="text-lg mt-1">{result === 'pass' ? 'PASS ✓' : result === 'fail' ? 'FAIL ✗' : '—'}</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* SECTION 3: Complete */}
      {activeSection === 3 && (
        <div className="space-y-4">
          <h2 className="font-semibold text-gray-800 text-sm">Complete session</h2>

          <div className="space-y-2">
            {gauges.slice(0, numGauges).map((gauge, idx) => {
              const result = gaugeOverallResult(gauge)
              return (
                <div key={gauge.uid} className="card p-4 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-gray-800">Gauge {idx + 1} — {gauge.instrument?.name || 'Not selected'}</div>
                    {gauge.instrument && (
                      <div className="text-xs text-gray-400 mt-0.5">
                        S/N: {gauge.instrument.serial_number} · {gauge.instrument.customer?.name}
                      </div>
                    )}
                  </div>
                  <span className={`text-sm font-bold ${result === 'pass' ? 'text-green-600' : result === 'fail' ? 'text-red-600' : 'text-gray-400'}`}>
                    {result === 'pass' ? 'PASS ✓' : result === 'fail' ? 'FAIL ✗' : '—'}
                  </span>
                </div>
              )
            })}
          </div>

          <div className="bg-brand-50 rounded-xl p-4 text-sm text-brand-700">
            <div className="font-semibold mb-1">This will generate {gauges.filter(g => g.instrument).length} separate certificate{gauges.filter(g => g.instrument).length !== 1 ? 's' : ''}</div>
            <div className="text-xs text-gray-500">Each gauge gets its own certificate number and PDF</div>
          </div>

          {saveMsg && <div className="text-sm text-brand-600 bg-brand-50 rounded-xl px-4 py-2">{saveMsg}</div>}

          <button onClick={handleSave} disabled={saving}
            className="w-full py-3 rounded-xl bg-brand-500 text-white font-semibold text-sm disabled:opacity-50">
            {saving ? saveMsg || 'Generating certificates...' : `✓ Generate ${gauges.filter(g => g.instrument).length} certificate${gauges.filter(g => g.instrument).length !== 1 ? 's' : ''}`}
          </button>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-3 flex gap-3">
        {activeSection > 0 && <button onClick={() => setActiveSection(s => s - 1)} className="btn-secondary flex-1">Back</button>}
        {activeSection < sections.length - 1 && <button onClick={() => setActiveSection(s => s + 1)} className="btn-primary flex-1">Next</button>}
      </div>
    </div>
  )
}
