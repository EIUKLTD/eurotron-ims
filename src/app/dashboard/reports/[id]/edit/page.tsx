'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

interface CalRow {
  id: string
  parameter: string
  gas: string
  nominal_type: 'fixed' | 'from_bottle'
  nominal: string
  unit: string
  tolerance_type: 'fixed_abs' | 'pct_of_nominal'
  tolerance: string
  tolerance_unit: string
  measured: string
  error: string
  result: 'pass' | 'fail' | 'not_installed' | ''
  tolerance_display: string
  bottle_used: string
}

interface PartRow {
  id: string
  description: string
  part_number: string
  quantity: number
  warranty: string
  save_to_library: boolean
}

interface SelectedBottle { uid: string; stdId: string }

function uid() { return Math.random().toString(36).slice(2) }
function emptyPart(): PartRow { return { id: uid(), description: '', part_number: '', quantity: 1, warranty: '', save_to_library: false } }

function calcToleranceDisplay(row: CalRow): string {
  if (row.tolerance_type === 'fixed_abs') return `+/-${row.tolerance} ${row.tolerance_unit}`
  if (row.tolerance_type === 'pct_of_nominal') {
    const nom = parseFloat(row.nominal)
    if (!isNaN(nom) && nom !== 0) {
      const absVal = Math.abs(nom * parseFloat(row.tolerance) / 100)
      return `+/-${absVal.toFixed(4)} ${row.unit} (+/-${row.tolerance}%)`
    }
    return `+/-${row.tolerance}% of nominal`
  }
  return ''
}

function calcError(row: CalRow): { error: string; result: 'pass' | 'fail' | 'not_installed' | '' } {
  if (!row.measured || row.measured.trim() === '') return { error: '', result: 'not_installed' }
  const nom = parseFloat(row.nominal)
  const meas = parseFloat(row.measured)
  if (isNaN(nom) || isNaN(meas)) return { error: '', result: '' }
  const raw = meas - nom
  let tol = 0
  if (row.tolerance_type === 'fixed_abs') tol = parseFloat(row.tolerance)
  else if (row.tolerance_type === 'pct_of_nominal') tol = Math.abs(nom * parseFloat(row.tolerance) / 100)
  const error = (raw >= 0 ? '+' : '') + parseFloat(raw.toFixed(6)) + ' ' + row.unit
  const result = Math.abs(raw) <= tol ? 'pass' : 'fail'
  return { error, result }
}

function MeasuredInput({ row, onUpdate }: { row: CalRow; onUpdate: (id: string, val: string) => void }) {
  return (
    <input type="number" step="any"
      className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white"
      defaultValue={row.measured}
      placeholder="Leave blank = Not installed"
      onBlur={e => onUpdate(row.id, e.target.value)} />
  )
}

export default function EditReportPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading]         = useState(true)
  const [standards, setStandards]     = useState<any[]>([])
  const [partsLib, setPartsLib]       = useState<any[]>([])
  const [faultTypes, setFaultTypes]   = useState<any[]>([])
  const [profile, setProfile]         = useState<any>(null)
  const [selInstrument, setSelInstrument] = useState<any>(null)
  const [selCustomer, setSelCustomer] = useState<any>(null)

  const [visitDate, setVisitDate]     = useState('')
  const [visitTime, setVisitTime]     = useState('')
  const [siteLocation, setSiteLocation] = useState('')
  const [contactName, setContactName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [firmware, setFirmware]       = useState('')
  const [findings, setFindings]       = useState('')
  const [workDone, setWorkDone]       = useState('')
  const [recommendations, setRecommendations] = useState('')
  const [labourHours, setLabourHours] = useState('')
  const [custPrintName, setCustPrintName] = useState('')
  const [sageNumber, setSageNumber]   = useState('')
  const [selectedFaults, setSelectedFaults] = useState<string[]>([])

  const [arrivalRows, setArrivalRows] = useState<CalRow[]>([])
  const [asLeftRows, setAsLeftRows]   = useState<CalRow[]>([])
  const [arrivalBottles, setArrivalBottles] = useState<SelectedBottle[]>([{ uid: uid(), stdId: '' }])
  const [asLeftBottles, setAsLeftBottles]   = useState<SelectedBottle[]>([{ uid: uid(), stdId: '' }])
  const [partRows, setPartRows]       = useState<PartRow[]>([])
  const [showPartPicker, setShowPartPicker] = useState(false)
  const [partSearch, setPartSearch]   = useState('')
  const [activeSection, setActiveSection] = useState(0)
  const [saving, setSaving]           = useState(false)
  const [saveMsg, setSaveMsg]         = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      const [{ data: prof }, { data: stds }, { data: parts }, { data: faults }, { data: report }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user!.id).single(),
        supabase.from('reference_standards').select('*').eq('active', true).order('description'),
        supabase.from('parts_library').select('*').eq('active', true).order('description'),
        supabase.from('fault_types').select('*').eq('active', true).order('sort_order'),
        supabase.from('service_reports').select('*, instrument:instruments(*, customer:customers(*), site:sites(*)), customer:customers(*), calibration_records(*), report_parts(*), report_standards(*)').eq('id', id).single(),
      ])

      setProfile(prof)
      setStandards(stds || [])
      setPartsLib(parts || [])
      setFaultTypes(faults || [])

      if (report) {
        setSelInstrument(report.instrument)
        setSelCustomer(report.customer)
        setVisitDate(report.visit_date || '')
        setVisitTime(report.visit_time || '')
        setSiteLocation(report.site_location || '')
        setContactName(report.contact_name || '')
        setCustomerEmail(report.customer?.contact_email || '')
        setFirmware(report.firmware_at_visit || '')
        setFindings(report.findings || '')
        setWorkDone(report.work_carried_out || '')
        setRecommendations(report.recommendations || '')
        setLabourHours(report.labour_hours ? String(report.labour_hours) : '')
        setCustPrintName(report.customer_printed_name || '')
        setSageNumber(report.sage_number || '')
        setSelectedFaults(report.fault_codes || [])

        // Load calibration rows
        const calRows = report.calibration_records || []
        const arrival = calRows.filter((r: any) => r.phase === 'arrival').sort((a: any, b: any) => a.sort_order - b.sort_order)
        const asLeft  = calRows.filter((r: any) => r.phase === 'as_left').sort((a: any, b: any) => a.sort_order - b.sort_order)

        setArrivalRows(arrival.map((r: any) => ({
          id: uid(), parameter: r.parameter || '', gas: '', nominal_type: 'fixed' as const,
          nominal: r.nominal || '', unit: '', tolerance_type: 'fixed_abs' as const,
          tolerance: '', tolerance_unit: '', measured: r.measured || '',
          error: r.error_value || '', result: r.result || '' as any,
          tolerance_display: r.tolerance || '', bottle_used: ''
        })))

        setAsLeftRows(asLeft.map((r: any) => ({
          id: uid(), parameter: r.parameter || '', gas: '', nominal_type: 'fixed' as const,
          nominal: r.nominal || '', unit: '', tolerance_type: 'fixed_abs' as const,
          tolerance: '', tolerance_unit: '', measured: r.measured || '',
          error: r.error_value || '', result: r.result || '' as any,
          tolerance_display: r.tolerance || '', bottle_used: ''
        })))

        // Load parts
        setPartRows((report.report_parts || []).map((p: any) => ({
          id: uid(), description: p.description || '', part_number: p.part_number || '',
          quantity: p.quantity || 1, warranty: p.warranty || '', save_to_library: false
        })))
      }
      setLoading(false)
    }
    load()
  }, [id])

  function applyBottleToRows(rows: CalRow[], stdId: string): CalRow[] {
    if (!stdId) return rows
    const std = standards.find((s: any) => s.id === stdId)
    if (!std || !std.gas_concentrations) return rows
    return rows.map(row => {
      const match = std.gas_concentrations.find((g: any) => g.gas === row.gas)
      if (!match) return row
      const updated = { ...row, nominal: match.concentration, unit: match.unit, bottle_used: stdId }
      updated.tolerance_display = calcToleranceDisplay(updated)
      return updated
    })
  }

  function reapplyAllBottles(bottles: SelectedBottle[], rows: CalRow[]): CalRow[] {
    let result = rows
    bottles.forEach(b => { if (b.stdId) result = applyBottleToRows(result, b.stdId) })
    return result
  }

  function handleArrivalBottleChange(uid: string, newStdId: string) {
    const updated = arrivalBottles.map(b => b.uid === uid ? { ...b, stdId: newStdId } : b)
    setArrivalBottles(updated)
    setArrivalRows(prev => reapplyAllBottles(updated, prev))
  }

  function handleAsLeftBottleChange(uid: string, newStdId: string) {
    const updated = asLeftBottles.map(b => b.uid === uid ? { ...b, stdId: newStdId } : b)
    setAsLeftBottles(updated)
    setAsLeftRows(prev => reapplyAllBottles(updated, prev))
  }

  const updateArrivalMeasured = useCallback((rowId: string, val: string) => {
    setArrivalRows(prev => prev.map(row => {
      if (row.id !== rowId) return row
      const updated = { ...row, measured: val }
      if (!val || val.trim() === '') return { ...updated, error: '', result: 'not_installed' as const }
      const { error, result } = calcError(updated)
      return { ...updated, error, result }
    }))
  }, [])

  const updateAsLeftMeasured = useCallback((rowId: string, val: string) => {
    setAsLeftRows(prev => prev.map(row => {
      if (row.id !== rowId) return row
      const updated = { ...row, measured: val }
      if (!val || val.trim() === '') return { ...updated, error: '', result: 'not_installed' as const }
      const { error, result } = calcError(updated)
      return { ...updated, error, result }
    }))
  }, [])

  function toggleFault(description: string) {
    setSelectedFaults(prev => prev.includes(description) ? prev.filter(f => f !== description) : [...prev, description])
  }

  function overallResult(): 'pass' | 'fail' | 'na' {
    const all = [...arrivalRows, ...asLeftRows].filter(r => r.result === 'pass' || r.result === 'fail')
    if (!all.length) return 'na'
    return all.some(r => r.result === 'fail') ? 'fail' : 'pass'
  }

  async function handleSave(saveAsDraft = false) {
    setSaving(true); setSaveMsg('Saving...')

    const faultText = selectedFaults.length > 0 ? selectedFaults.join('\n') : ''
    const fullFindings = [faultText, findings].filter(Boolean).join('\n')

    const { error: rErr } = await supabase.from('service_reports').update({
      visit_date: visitDate, visit_time: visitTime || null,
      site_location: siteLocation || null, contact_name: contactName || null,
      firmware_at_visit: firmware || null, findings: fullFindings || null,
      work_carried_out: workDone || null, recommendations: recommendations || null,
      labour_hours: labourHours ? parseFloat(labourHours) : null,
      overall_result: overallResult(),
      customer_printed_name: custPrintName || null,
      sage_number: sageNumber || null,
      fault_codes: selectedFaults,
      status: saveAsDraft ? 'draft' : 'complete',
    }).eq('id', id)

    if (rErr) { alert('Error: ' + rErr.message); setSaving(false); return }

    // Delete and re-insert calibration records
    await supabase.from('calibration_records').delete().eq('report_id', id)
    const calInserts = [
      ...arrivalRows.filter(r => r.parameter).map((r, i) => ({
        report_id: id, phase: 'arrival', sort_order: i, parameter: r.parameter,
        nominal: r.nominal || null, tolerance: r.tolerance_display,
        measured: r.measured || null,
        error_value: r.result === 'not_installed' ? 'Not installed' : r.error,
        result: r.result === 'not_installed' ? null : (r.result || null)
      })),
      ...asLeftRows.filter(r => r.parameter).map((r, i) => ({
        report_id: id, phase: 'as_left', sort_order: i, parameter: r.parameter,
        nominal: r.nominal || null, tolerance: r.tolerance_display,
        measured: r.measured || null,
        error_value: r.result === 'not_installed' ? 'Not installed' : r.error,
        result: r.result === 'not_installed' ? null : (r.result || null)
      }))
    ]
    if (calInserts.length) await supabase.from('calibration_records').insert(calInserts)

    // Delete and re-insert parts
    await supabase.from('report_parts').delete().eq('report_id', id)
    const partInserts = partRows.filter(r => r.description).map(r => ({
      report_id: id, description: r.description,
      part_number: r.part_number, quantity: r.quantity, warranty: r.warranty || null
    }))
    if (partInserts.length) await supabase.from('report_parts').insert(partInserts)

    // Update instrument dates if completing
    if (!saveAsDraft && selInstrument) {
      await supabase.from('instruments').update({
        last_cal_date: visitDate, last_service_date: visitDate,
        next_cal_date: new Date(new Date(visitDate).setMonth(new Date(visitDate).getMonth() + (selInstrument?.cal_interval_months ?? 12))).toISOString().split('T')[0],
        firmware_version: firmware || selInstrument?.firmware_version,
      }).eq('id', selInstrument.id)
    }

    setSaving(false)
    setSaveMsg(saveAsDraft ? 'Draft saved!' : 'Report completed!')
    setTimeout(() => router.push(`/dashboard/reports/${id}`), 1000)
  }

  const faultCategories = [...new Set(faultTypes.map(f => f.category))]
  const sections = ['Visit details', 'Faults found', 'On arrival', 'As left', 'Service notes', 'Parts used', 'Complete']
  const overall = overallResult()

  if (loading) return <div className="p-8 text-gray-400 text-sm">Loading report...</div>

  return (
    <div className="p-4 max-w-2xl mx-auto pb-32">
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="text-xs text-gray-400 mb-1">
            <a href={`/dashboard/reports/${id}`} className="hover:text-brand-500">Report</a> / Edit draft
          </div>
          <h1 className="text-xl font-semibold text-gray-900">Edit draft report</h1>
          <p className="text-gray-400 text-xs mt-0.5">{selInstrument?.name} · {selCustomer?.name}</p>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-400">Result</div>
          <span className={`text-sm font-bold ${overall === 'pass' ? 'text-green-600' : overall === 'fail' ? 'text-red-600' : 'text-gray-400'}`}>
            {overall === 'pass' ? 'PASS' : overall === 'fail' ? 'FAIL' : '-'}
          </span>
        </div>
      </div>

      <div className="flex gap-1.5 mb-6 overflow-x-auto pb-1">
        {sections.map((s, i) => (
          <button key={i} onClick={() => setActiveSection(i)}
            className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${activeSection === i ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
            {i + 1}. {s.split(' ')[0]}
          </button>
        ))}
      </div>

      {/* Section 0: Visit details */}
      {activeSection === 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-gray-800 text-sm">Visit details</h2>
          <div className="bg-brand-50 rounded-xl p-3 text-xs space-y-1">
            <div className="flex justify-between"><span className="text-gray-500">Instrument</span><span className="font-medium">{selInstrument?.name}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Customer</span><span className="font-medium">{selCustomer?.name}</span></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Visit date</label><input className="input" type="date" value={visitDate} onChange={e => setVisitDate(e.target.value)} /></div>
            <div><label className="label">Visit time</label><input className="input" type="time" value={visitTime} onChange={e => setVisitTime(e.target.value)} /></div>
          </div>
          <div><label className="label">Site / location</label><input className="input" value={siteLocation} onChange={e => setSiteLocation(e.target.value)} /></div>
          <div><label className="label">Contact person</label><input className="input" value={contactName} onChange={e => setContactName(e.target.value)} /></div>
          <div><label className="label">Customer email</label><input className="input" type="email" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} /></div>
          <div><label className="label">Firmware version</label><input className="input" value={firmware} onChange={e => setFirmware(e.target.value)} /></div>
          <div><label className="label">Sage sales number</label><input className="input" value={sageNumber} onChange={e => setSageNumber(e.target.value)} /></div>
        </div>
      )}

      {/* Section 1: Faults */}
      {activeSection === 1 && (
        <div className="space-y-4">
          <div>
            <h2 className="font-semibold text-gray-800 text-sm">Faults found on arrival</h2>
            <p className="text-xs text-gray-400 mt-0.5">Tick all faults found.</p>
          </div>
          {selectedFaults.length > 0 && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-3">
              <p className="text-xs font-semibold text-red-700 mb-1">{selectedFaults.length} fault{selectedFaults.length !== 1 ? 's' : ''} selected:</p>
              <div className="flex flex-wrap gap-1">
                {selectedFaults.map(f => <span key={f} className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{f}</span>)}
              </div>
            </div>
          )}
          {faultCategories.map(cat => (
            <div key={cat} className="card p-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{cat}</h3>
              <div className="space-y-2">
                {faultTypes.filter(f => f.category === cat).map(fault => (
                  <label key={fault.id} className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={selectedFaults.includes(fault.description)}
                      onChange={() => toggleFault(fault.description)}
                      className="w-4 h-4 rounded border-gray-300 text-brand-500" />
                    <span className={`text-sm ${selectedFaults.includes(fault.description) ? 'text-red-700 font-medium' : 'text-gray-700'}`}>
                      {fault.description}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
          <div><label className="label">Additional findings</label><textarea className="input" rows={3} value={findings} onChange={e => setFindings(e.target.value)} /></div>
        </div>
      )}

      {/* Section 2: On arrival */}
      {activeSection === 2 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-gray-800 text-sm">On arrival (as found)</h2>
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-xs" style={{ minWidth: 400 }}>
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase tracking-wider">
                  <th className="px-3 py-2 text-left">Parameter</th>
                  <th className="px-3 py-2 text-left">Nominal</th>
                  <th className="px-3 py-2 text-left">Tolerance</th>
                  <th className="px-3 py-2 text-left">Measured</th>
                  <th className="px-3 py-2 text-left">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {arrivalRows.map(row => (
                  <tr key={row.id}>
                    <td className="px-3 py-2 font-medium text-gray-800">{row.parameter}</td>
                    <td className="px-3 py-2 font-mono text-blue-600 text-xs">{row.nominal || '-'}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{row.tolerance_display || '-'}</td>
                    <td className="px-3 py-2"><MeasuredInput row={row} onUpdate={updateArrivalMeasured} /></td>
                    <td className="px-3 py-2">
                      {row.result === 'not_installed' ? <span className="text-xs text-gray-400 italic">Not installed</span>
                       : row.result === 'pass' ? <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">Pass</span>
                       : row.result === 'fail' ? <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">Fail</span>
                       : <span className="text-gray-300">-</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Section 3: As left */}
      {activeSection === 3 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-gray-800 text-sm">As left (after service)</h2>
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-xs" style={{ minWidth: 400 }}>
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase tracking-wider">
                  <th className="px-3 py-2 text-left">Parameter</th>
                  <th className="px-3 py-2 text-left">Nominal</th>
                  <th className="px-3 py-2 text-left">Tolerance</th>
                  <th className="px-3 py-2 text-left">Measured</th>
                  <th className="px-3 py-2 text-left">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {asLeftRows.map(row => (
                  <tr key={row.id}>
                    <td className="px-3 py-2 font-medium text-gray-800">{row.parameter}</td>
                    <td className="px-3 py-2 font-mono text-blue-600 text-xs">{row.nominal || '-'}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{row.tolerance_display || '-'}</td>
                    <td className="px-3 py-2"><MeasuredInput row={row} onUpdate={updateAsLeftMeasured} /></td>
                    <td className="px-3 py-2">
                      {row.result === 'not_installed' ? <span className="text-xs text-gray-400 italic">Not installed</span>
                       : row.result === 'pass' ? <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">Pass</span>
                       : row.result === 'fail' ? <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">Fail</span>
                       : <span className="text-gray-300">-</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Section 4: Service notes */}
      {activeSection === 4 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-gray-800 text-sm">Service notes</h2>
          <div><label className="label">Work carried out</label><textarea className="input" rows={4} value={workDone} onChange={e => setWorkDone(e.target.value)} /></div>
          <div><label className="label">Recommendations</label><textarea className="input" rows={3} value={recommendations} onChange={e => setRecommendations(e.target.value)} /></div>
          <div><label className="label">Labour time (hours)</label><input className="input" type="number" step="0.5" min="0" value={labourHours} onChange={e => setLabourHours(e.target.value)} style={{ width: 120 }} /></div>
        </div>
      )}

      {/* Section 5: Parts */}
      {activeSection === 5 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-800 text-sm">Parts used</h2>
            <button onClick={() => setShowPartPicker(true)} className="btn-secondary text-xs py-1.5">Pick from library</button>
          </div>
          {showPartPicker && (
            <div className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-700">Parts library</span>
                <button onClick={() => { setShowPartPicker(false); setPartSearch('') }} className="text-gray-400 text-lg">x</button>
              </div>
              <input className="input text-sm mb-3" placeholder="Search parts..." value={partSearch} onChange={e => setPartSearch(e.target.value)} />
              <div className="space-y-1 max-h-56 overflow-y-auto">
                {partsLib.filter(p => !partSearch || p.description.toLowerCase().includes(partSearch.toLowerCase())).map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                    <div><div className="text-sm text-gray-800">{p.description}</div><div className="text-xs text-gray-400">{p.part_number ?? '-'}</div></div>
                    <button onClick={() => setPartRows(r => [...r, { ...emptyPart(), description: p.description, part_number: p.part_number ?? '' }])}
                      className="text-xs text-brand-500 hover:underline ml-4">+ Add</button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {partRows.length > 0 && (
            <div className="space-y-2">
              {partRows.map(row => (
                <div key={row.id} className="grid grid-cols-12 gap-1 items-center">
                  <input className="col-span-4 border border-gray-200 rounded px-2 py-1.5 text-xs" value={row.description} placeholder="Description" onChange={e => setPartRows(partRows.map(r => r.id !== row.id ? r : { ...r, description: e.target.value }))} />
                  <input className="col-span-3 border border-gray-200 rounded px-2 py-1.5 text-xs" value={row.part_number} placeholder="Part no." onChange={e => setPartRows(partRows.map(r => r.id !== row.id ? r : { ...r, part_number: e.target.value }))} />
                  <input className="col-span-1 border border-gray-200 rounded px-2 py-1.5 text-xs" type="number" min="1" value={row.quantity} onChange={e => setPartRows(partRows.map(r => r.id !== row.id ? r : { ...r, quantity: parseInt(e.target.value) || 1 }))} />
                  <select className={`col-span-3 border rounded px-1 py-1.5 text-xs ${row.warranty === 'yes' ? 'border-green-300 bg-green-50 text-green-700' : row.warranty === 'no' ? 'border-red-200 bg-red-50 text-red-600' : 'border-gray-200'}`}
                    value={row.warranty} onChange={e => setPartRows(partRows.map(r => r.id !== row.id ? r : { ...r, warranty: e.target.value }))}>
                    <option value="">Warranty?</option><option value="yes">Yes</option><option value="no">No</option><option value="na">N/A</option>
                  </select>
                  <button onClick={() => setPartRows(partRows.filter(r => r.id !== row.id))} className="col-span-1 text-gray-300 hover:text-red-400 text-base text-center">x</button>
                </div>
              ))}
            </div>
          )}
          <button onClick={() => setPartRows(r => [...r, emptyPart()])} className="text-xs text-brand-500 hover:underline">+ Add part manually</button>
        </div>
      )}

      {/* Section 6: Complete */}
      {activeSection === 6 && (
        <div className="space-y-4">
          <h2 className="font-semibold text-gray-800 text-sm">Complete report</h2>
          <div className="card p-4 space-y-2 text-xs">
            <div className="flex justify-between"><span className="text-gray-500">Instrument</span><span className="font-medium">{selInstrument?.name ?? '-'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Customer</span><span className="font-medium">{selCustomer?.name ?? '-'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Date</span><span className="font-medium">{visitDate}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Result</span>
              <span className={`font-bold ${overall === 'pass' ? 'text-green-600' : overall === 'fail' ? 'text-red-600' : 'text-gray-400'}`}>
                {overall === 'pass' ? 'PASS' : overall === 'fail' ? 'FAIL' : '-'}
              </span>
            </div>
            {selectedFaults.length > 0 && (
              <div className="flex justify-between"><span className="text-gray-500">Faults</span><span className="font-medium text-red-600">{selectedFaults.length} recorded</span></div>
            )}
          </div>
          <div><label className="label">Customer printed name</label><input className="input" value={custPrintName} onChange={e => setCustPrintName(e.target.value)} placeholder="Print name" /></div>
          {saveMsg && <div className="text-sm text-brand-600 bg-brand-50 rounded-xl px-4 py-2">{saveMsg}</div>}
          <div className="space-y-2 pt-2">
            <button onClick={() => handleSave(true)} disabled={saving}
              className="w-full py-3 rounded-xl border-2 border-amber-400 bg-amber-50 hover:bg-amber-100 text-amber-700 font-semibold text-sm transition-colors disabled:opacity-50">
              {saving ? 'Saving...' : '💾 Save as draft again'}
            </button>
            <button onClick={() => handleSave(false)} disabled={saving}
              className="w-full py-3 rounded-xl bg-brand-500 hover:bg-brand-700 text-white font-semibold text-sm transition-colors disabled:opacity-50">
              {saving ? 'Saving...' : '✓ Complete report'}
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
