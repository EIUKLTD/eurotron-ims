'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'

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

interface SelectedBottle {
  uid: string
  stdId: string
}

function uid() { return Math.random().toString(36).slice(2) }
function emptyPart(): PartRow {
  return { id: uid(), description: '', part_number: '', quantity: 1, warranty: '', save_to_library: false }
}

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

function SigCanvas({ label, canvasRef, onSign }: { label: string; canvasRef: React.RefObject<HTMLCanvasElement>; onSign: () => void }) {
  const [signed, setSigned] = useState(false)
  const drawing = useRef(false)
  const last = useRef<[number, number]>([0, 0])
  function getPos(e: React.TouchEvent | React.MouseEvent, canvas: HTMLCanvasElement): [number, number] {
    const r = canvas.getBoundingClientRect()
    const src = (e as React.TouchEvent).touches?.[0] ?? (e as React.MouseEvent)
    return [src.clientX - r.left, src.clientY - r.top]
  }
  function setup(canvas: HTMLCanvasElement) {
    const box = canvas.parentElement!
    const dpr = window.devicePixelRatio || 1
    const r = box.getBoundingClientRect()
    canvas.width = r.width * dpr; canvas.height = r.height * dpr
    canvas.style.width = r.width + 'px'; canvas.style.height = r.height + 'px'
    canvas.getContext('2d')!.scale(dpr, dpr)
  }
  function start(e: React.TouchEvent | React.MouseEvent) {
    e.preventDefault(); const c = canvasRef.current!
    drawing.current = true; last.current = getPos(e, c); setSigned(true); onSign()
  }
  function move(e: React.TouchEvent | React.MouseEvent) {
    if (!drawing.current) return; e.preventDefault()
    const c = canvasRef.current!; const [x, y] = getPos(e, c)
    const ctx = c.getContext('2d')!
    ctx.beginPath(); ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1.8; ctx.lineCap = 'round'
    ctx.moveTo(last.current[0], last.current[1]); ctx.lineTo(x, y); ctx.stroke()
    last.current = [x, y]
  }
  function end() { drawing.current = false }
  function clear() { const c = canvasRef.current!; c.getContext('2d')!.clearRect(0, 0, c.width, c.height); setSigned(false) }
  return (
    <div>
      <div className="relative border border-gray-200 rounded-xl bg-gray-50 overflow-hidden cursor-crosshair" style={{ height: 80 }}
        ref={el => { if (el && canvasRef.current) setup(canvasRef.current) }}>
        {!signed && <span className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm pointer-events-none">{label}</span>}
        <canvas ref={canvasRef} className="absolute inset-0 touch-none"
          onMouseDown={start} onMouseMove={move} onMouseUp={end}
          onTouchStart={start} onTouchMove={move} onTouchEnd={end} />
      </div>
      {signed && <button onClick={clear} className="text-xs text-gray-400 hover:text-red-500 mt-1">Clear</button>}
    </div>
  )
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

export default function NewReportPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const preselectedId = searchParams.get('instrument')

  const [instruments, setInstruments] = useState<any[]>([])
  const [standards, setStandards]     = useState<any[]>([])
  const [partsLib, setPartsLib]       = useState<any[]>([])
  const [templates, setTemplates]     = useState<any[]>([])
  const [faultTypes, setFaultTypes]   = useState<any[]>([])
  const [profile, setProfile]         = useState<any>(null)
  const [selInstrument, setSelInstrument] = useState<any>(null)
  const [selCustomer, setSelCustomer] = useState<any>(null)

  const today = new Date()
  const [instrumentId, setInstrumentId] = useState(preselectedId ?? '')
  const [visitDate, setVisitDate]     = useState(today.toISOString().split('T')[0])
  const [visitTime, setVisitTime]     = useState(today.toTimeString().slice(0, 5))
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

  const engSigRef  = useRef<HTMLCanvasElement>(null)
  const custSigRef = useRef<HTMLCanvasElement>(null)
  const [engSigned, setEngSigned]   = useState(false)
  const [custSigned, setCustSigned] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      const [{ data: prof }, { data: insts }, { data: stds }, { data: parts }, { data: tmpls }, { data: faults }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user!.id).single(),
        supabase.from('instruments').select('*, customer:customers(*), site:sites(*)').eq('status', 'active').order('name'),
        supabase.from('reference_standards').select('*').eq('active', true).order('description'),
        supabase.from('parts_library').select('*').eq('active', true).order('description'),
        supabase.from('cal_templates').select('*').eq('active', true).order('name'),
        supabase.from('fault_types').select('*').eq('active', true).order('sort_order'),
      ])
      setProfile(prof); setInstruments(insts || []); setStandards(stds || [])
      setPartsLib(parts || []); setTemplates(tmpls || []); setFaultTypes(faults || [])
      if (preselectedId && insts) {
        const inst = insts.find((i: any) => i.id === preselectedId)
        if (inst) doSelectInstrument(inst, tmpls || [])
      }
    }
    load()
  }, [])

  function doSelectInstrument(inst: any, tmpls?: any[]) {
    setSelInstrument(inst); setInstrumentId(inst.id); setFirmware(inst.firmware_version ?? '')
    const cust = inst.customer; const site = inst.site
    if (cust) { setSelCustomer(cust); setContactName(cust.contact_name ?? ''); setCustomerEmail(cust.contact_email ?? '') }
    if (site) setSiteLocation([site.name, site.address, site.city, site.postcode].filter(Boolean).join(', '))
    const availableTemplates = tmpls || templates
    if (availableTemplates.length > 0) doLoadTemplate(availableTemplates[0])
  }

  function doLoadTemplate(template: any) {
    const rows: CalRow[] = (template.parameters || []).map((p: any) => {
      const r: CalRow = {
        id: uid(), parameter: p.parameter, gas: p.gas,
        nominal_type: p.nominal_type, nominal: p.nominal_type === 'fixed' ? p.nominal : '',
        unit: p.unit || '', tolerance_type: p.tolerance_type,
        tolerance: p.tolerance, tolerance_unit: p.tolerance_unit || '',
        measured: '', error: '', result: '', tolerance_display: '', bottle_used: ''
      }
      r.tolerance_display = calcToleranceDisplay(r)
      return r
    })
    setArrivalRows(rows)
    setAsLeftRows(rows.map(r => ({ ...r, id: uid(), measured: '', error: '', result: '', bottle_used: '' })))
    setArrivalBottles([{ uid: uid(), stdId: '' }])
    setAsLeftBottles([{ uid: uid(), stdId: '' }])
  }

  function applyBottleToRows(rows: CalRow[], stdId: string): CalRow[] {
    if (!stdId) return rows
    const std = standards.find((s: any) => s.id === stdId)
    if (!std || !std.gas_concentrations) return rows
    return rows.map(row => {
      if (row.nominal_type !== 'from_bottle') return row
      const match = std.gas_concentrations.find((g: any) => g.gas === row.gas)
      if (!match) return row
      const updated = { ...row, nominal: match.concentration, unit: match.unit, bottle_used: stdId }
      updated.tolerance_display = calcToleranceDisplay(updated)
      return updated
    })
  }

  function reapplyAllBottles(bottles: SelectedBottle[], rows: CalRow[]): CalRow[] {
    let resetRows = rows.map(r => r.nominal_type === 'from_bottle' ? { ...r, nominal: '', unit: '', bottle_used: '', tolerance_display: '' } : r)
    bottles.forEach(b => { if (b.stdId) resetRows = applyBottleToRows(resetRows, b.stdId) })
    return resetRows
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

  function addArrivalBottle() { setArrivalBottles(b => [...b, { uid: uid(), stdId: '' }]) }
  function addAsLeftBottle()  { setAsLeftBottles(b => [...b, { uid: uid(), stdId: '' }]) }

  function removeArrivalBottle(buid: string) {
    const updated = arrivalBottles.filter(b => b.uid !== buid)
    setArrivalBottles(updated)
    setArrivalRows(prev => reapplyAllBottles(updated, prev))
  }
  function removeAsLeftBottle(buid: string) {
    const updated = asLeftBottles.filter(b => b.uid !== buid)
    setAsLeftBottles(updated)
    setAsLeftRows(prev => reapplyAllBottles(updated, prev))
  }

  const updateArrivalMeasured = useCallback((id: string, val: string) => {
    setArrivalRows(prev => prev.map(row => {
      if (row.id !== id) return row
      const updated = { ...row, measured: val }
      if (!val || val.trim() === '') return { ...updated, error: '', result: 'not_installed' as const }
      const { error, result } = calcError(updated)
      return { ...updated, error, result }
    }))
  }, [])

  const updateAsLeftMeasured = useCallback((id: string, val: string) => {
    setAsLeftRows(prev => prev.map(row => {
      if (row.id !== id) return row
      const updated = { ...row, measured: val }
      if (!val || val.trim() === '') return { ...updated, error: '', result: 'not_installed' as const }
      const { error, result } = calcError(updated)
      return { ...updated, error, result }
    }))
  }, [])

  function toggleFault(description: string) {
    setSelectedFaults(prev =>
      prev.includes(description)
        ? prev.filter(f => f !== description)
        : [...prev, description]
    )
  }

  function overallResult(): 'pass' | 'fail' | 'na' {
    const all = [...arrivalRows, ...asLeftRows].filter(r => r.result === 'pass' || r.result === 'fail')
    if (!all.length) return 'na'
    return all.some(r => r.result === 'fail') ? 'fail' : 'pass'
  }

  async function handleSave(sendEmail = false, saveAsDraft = false) {
    if (!instrumentId) { alert('Please select an instrument.'); return }
    setSaving(true); setSaveMsg('Saving report...')

    // Build findings from selected faults + free text
    const faultText = selectedFaults.length > 0 ? selectedFaults.join('\n') : ''
    const fullFindings = [faultText, findings].filter(Boolean).join('\n')

    const { data: report, error: rErr } = await supabase.from('service_reports').insert({
      instrument_id: instrumentId, customer_id: selCustomer?.id ?? selInstrument?.customer_id,
      engineer_id: profile?.id, visit_date: visitDate, visit_time: visitTime || null,
      site_location: siteLocation || null, contact_name: contactName || null,
      firmware_at_visit: firmware || null, findings: fullFindings || null,
      work_carried_out: workDone || null, recommendations: recommendations || null,
      labour_hours: labourHours ? parseFloat(labourHours) : null,
      overall_result: overallResult(), customer_printed_name: custPrintName || null,
      sage_number: sageNumber || null,
      fault_codes: selectedFaults,
      status: saveAsDraft ? 'draft' : 'complete',
    }).select().single()
    if (rErr || !report) { alert('Error: ' + rErr?.message); setSaving(false); return }

    setSaveMsg('Saving calibration records...')
    const calInserts = [
      ...arrivalRows.filter(r => r.parameter).map((r, i) => ({
        report_id: report.id, phase: 'arrival', sort_order: i, parameter: r.parameter,
        nominal: r.nominal ? `${r.nominal} ${r.unit}` : null,
        tolerance: r.tolerance_display, measured: r.measured || null,
        error_value: r.result === 'not_installed' ? 'Not installed' : r.error,
        result: r.result === 'not_installed' ? null : (r.result || null)
      })),
      ...asLeftRows.filter(r => r.parameter).map((r, i) => ({
        report_id: report.id, phase: 'as_left', sort_order: i, parameter: r.parameter,
        nominal: r.nominal ? `${r.nominal} ${r.unit}` : null,
        tolerance: r.tolerance_display, measured: r.measured || null,
        error_value: r.result === 'not_installed' ? 'Not installed' : r.error,
        result: r.result === 'not_installed' ? null : (r.result || null)
      }))
    ]
    if (calInserts.length) {
      const { error: calError } = await supabase.from('calibration_records').insert(calInserts)
      if (calError) { alert('Cal save error: ' + calError.message); setSaving(false); return }
    }

    const allStdIds = new Set([
      ...arrivalBottles.filter(b => b.stdId).map(b => b.stdId),
      ...asLeftBottles.filter(b => b.stdId).map(b => b.stdId)
    ])
    const stdInserts = Array.from(allStdIds).map(stdId => {
      const s = standards.find((s: any) => s.id === stdId)
      return s ? { report_id: report.id, standard_id: stdId, description: s.description, serial_number: s.serial_number, certificate_no: s.certificate_no, cal_due_date: s.cal_due_date } : null
    }).filter(Boolean)
    if (stdInserts.length) await supabase.from('report_standards').insert(stdInserts)

    const partInserts = partRows.filter(r => r.description).map(r => ({
      report_id: report.id, description: r.description,
      part_number: r.part_number, quantity: r.quantity, warranty: r.warranty || null
    }))
    if (partInserts.length) await supabase.from('report_parts').insert(partInserts)

    const newLibraryParts = partRows.filter(r => r.description && r.save_to_library)
    if (newLibraryParts.length) {
      await supabase.from('parts_library').insert(newLibraryParts.map(r => ({
        description: r.description, part_number: r.part_number || null, category: 'Other', active: true
      })))
    }

    if (!saveAsDraft) {
      await supabase.from('instruments').update({
        last_cal_date: visitDate, last_service_date: visitDate,
        next_cal_date: new Date(new Date(visitDate).setMonth(new Date(visitDate).getMonth() + (selInstrument?.cal_interval_months ?? 12))).toISOString().split('T')[0],
        firmware_version: firmware || selInstrument?.firmware_version,
      }).eq('id', instrumentId)
    }

    setSaveMsg(saveAsDraft ? 'Draft saved!' : 'Report saved!')
    if (!saveAsDraft && sendEmail && customerEmail) {
      const subj = `Service & Calibration Report ${report.report_number} - ${selCustomer?.name ?? ''} - ${visitDate}`
      const body = `Dear ${selCustomer?.name ?? 'Customer'},\n\nPlease find attached the service and calibration report for the visit on ${visitDate}.\n\nReport: ${report.report_number}\nInstrument: ${selInstrument?.name ?? ''}\nResult: ${overallResult().toUpperCase()}\n\nKind regards,\n${profile?.full_name ?? 'Eurotron Instruments (UK) Ltd'}\nEurotron Instruments (UK) Ltd`
      window.location.href = `mailto:${encodeURIComponent(customerEmail)}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(body)}`
      await supabase.from('service_reports').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', report.id)
    }
    setSaving(false)
    router.push(`/dashboard/reports/${report.id}`)
  }

  function BottleSelector({ bottles, onBottleChange, onAdd, onRemove }: {
    bottles: SelectedBottle[]
    onBottleChange: (uid: string, stdId: string) => void
    onAdd: () => void
    onRemove: (uid: string) => void
  }) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="label mb-0 font-semibold">Span gas bottle(s) used</label>
          <button onClick={onAdd} className="text-xs text-brand-500 hover:underline">+ Add bottle</button>
        </div>
        {bottles.map((b, i) => (
          <div key={b.uid} className="flex gap-2 items-start">
            <div className="flex-1">
              <select className="input" value={b.stdId} onChange={e => onBottleChange(b.uid, e.target.value)}>
                <option value="">Select bottle {i + 1}...</option>
                {standards.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.description} (S/N: {s.serial_number})</option>
                ))}
              </select>
              {b.stdId && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {standards.find((s: any) => s.id === b.stdId)?.gas_concentrations?.map((g: any, gi: number) => (
                    <span key={gi} className="badge-info font-mono text-xs">{g.gas}: {g.concentration} {g.unit}</span>
                  ))}
                </div>
              )}
            </div>
            {bottles.length > 1 && (
              <button onClick={() => onRemove(b.uid)} className="text-red-400 hover:text-red-600 text-sm mt-2">x</button>
            )}
          </div>
        ))}
      </div>
    )
  }

  function CalTable({ rows, onUpdate }: { rows: CalRow[]; onUpdate: (id: string, val: string) => void }) {
    return (
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-xs" style={{ minWidth: 540 }}>
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase tracking-wider">
              <th className="px-3 py-2 text-left">Parameter</th>
              <th className="px-3 py-2 text-left">Nominal</th>
              <th className="px-3 py-2 text-left">Tolerance</th>
              <th className="px-3 py-2 text-left">Measured</th>
              <th className="px-3 py-2 text-left">Error</th>
              <th className="px-3 py-2 text-left">Result</th>
              <th className="px-3 py-2 text-left">Bottle</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map(row => {
              const bottleStd = row.bottle_used ? standards.find((s: any) => s.id === row.bottle_used) : null
              return (
                <tr key={row.id} className={row.result === 'not_installed' ? 'bg-gray-50 opacity-60' : ''}>
                  <td className="px-3 py-2 font-medium text-gray-800">{row.parameter}</td>
                  <td className="px-3 py-2 font-mono text-blue-600 text-xs">
                    {row.nominal ? `${row.nominal} ${row.unit}` : <span className="text-gray-400 italic">select bottle</span>}
                  </td>
                  <td className="px-3 py-2 font-mono text-green-700 text-xs">{row.tolerance_display || '-'}</td>
                  <td className="px-3 py-2"><MeasuredInput row={row} onUpdate={onUpdate} /></td>
                  <td className="px-3 py-2 font-mono text-gray-500 text-xs">{row.result === 'not_installed' ? '-' : row.error || '-'}</td>
                  <td className="px-3 py-2">
                    {row.result === 'not_installed' ? <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500 italic">Not installed</span>
                     : row.result === 'pass' ? <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">Pass</span>
                     : row.result === 'fail' ? <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">Fail</span>
                     : <span className="text-gray-300">-</span>}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-400">
                    {row.nominal_type === 'fixed' ? <span className="italic">N/A</span>
                     : bottleStd ? <span className="font-mono text-xs text-brand-600">{bottleStd.serial_number}</span>
                     : <span className="italic text-gray-300">-</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  // Group fault types by category
  const faultCategories = [...new Set(faultTypes.map(f => f.category))]

  const sections = ['Customer & instrument', 'Faults found', 'On arrival (as found)', 'As left (after service)', 'Service notes', 'Parts used', 'Sign-off & send']
  const overall = overallResult()

  return (
    <div className="p-4 max-w-2xl mx-auto pb-32">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">New service report</h1>
          <p className="text-gray-400 text-xs mt-0.5">Eurotron Instruments (UK) Ltd</p>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-400">Overall result</div>
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

      {/* Section 0: Customer & instrument */}
      {activeSection === 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-gray-800 text-sm">Customer & instrument</h2>
          <div>
            <label className="label">Instrument *</label>
            <select className="input" value={instrumentId} onChange={e => { const inst = instruments.find(i => i.id === e.target.value); if (inst) doSelectInstrument(inst) }}>
              <option value="">Select instrument...</option>
              {instruments.map(i => <option key={i.id} value={i.id}>{i.name} - {i.customer?.name}{i.site ? ' / ' + i.site.name : ''} (S/N: {i.serial_number ?? 'N/A'})</option>)}
            </select>
          </div>
          {selInstrument && (
            <div className="bg-brand-50 rounded-xl p-3 text-xs space-y-1">
              <div className="flex justify-between"><span className="text-gray-500">Make / model</span><span className="font-medium">{selInstrument.make} {selInstrument.model}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Last cal</span><span className="font-medium">{selInstrument.last_cal_date ?? '-'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Next cal due</span><span className="font-medium text-amber-600">{selInstrument.next_cal_date ?? '-'}</span></div>
            </div>
          )}
          {templates.length > 1 && (
            <div>
              <label className="label">Calibration template</label>
              <select className="input" onChange={e => { const t = templates.find(t => t.id === e.target.value); if (t) doLoadTemplate(t) }}>
                {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Visit date</label><input className="input" type="date" value={visitDate} onChange={e => setVisitDate(e.target.value)} /></div>
            <div><label className="label">Visit time</label><input className="input" type="time" value={visitTime} onChange={e => setVisitTime(e.target.value)} /></div>
          </div>
          <div><label className="label">Site / location</label><input className="input" value={siteLocation} onChange={e => setSiteLocation(e.target.value)} /></div>
          <div><label className="label">Contact person</label><input className="input" value={contactName} onChange={e => setContactName(e.target.value)} /></div>
          <div><label className="label">Customer email</label><input className="input" type="email" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} /></div>
          <div><label className="label">Firmware version</label><input className="input" value={firmware} onChange={e => setFirmware(e.target.value)} /></div>
          <div><label className="label">Sage sales number</label><input className="input" value={sageNumber} onChange={e => setSageNumber(e.target.value)} placeholder="e.g. SO-12345" /></div>
        </div>
      )}

      {/* Section 1: Faults found */}
      {activeSection === 1 && (
        <div className="space-y-4">
          <div>
            <h2 className="font-semibold text-gray-800 text-sm">Faults found on arrival</h2>
            <p className="text-xs text-gray-400 mt-0.5">Tick all faults found. These will appear in the findings section.</p>
          </div>

          {selectedFaults.length > 0 && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-3">
              <p className="text-xs font-semibold text-red-700 mb-1">{selectedFaults.length} fault{selectedFaults.length !== 1 ? 's' : ''} selected:</p>
              <div className="flex flex-wrap gap-1">
                {selectedFaults.map(f => (
                  <span key={f} className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{f}</span>
                ))}
              </div>
            </div>
          )}

          {faultCategories.map(cat => (
            <div key={cat} className="card p-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{cat}</h3>
              <div className="space-y-2">
                {faultTypes.filter(f => f.category === cat).map(fault => (
                  <label key={fault.id} className="flex items-center gap-3 cursor-pointer group">
                    <input type="checkbox"
                      checked={selectedFaults.includes(fault.description)}
                      onChange={() => toggleFault(fault.description)}
                      className="w-4 h-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500" />
                    <span className={`text-sm ${selectedFaults.includes(fault.description) ? 'text-red-700 font-medium' : 'text-gray-700'}`}>
                      {fault.description}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}

          <div>
            <label className="label">Additional findings (free text)</label>
            <textarea className="input" rows={3} value={findings} onChange={e => setFindings(e.target.value)} placeholder="Any other observations not in the list above..." />
          </div>
        </div>
      )}

      {/* Section 2: On arrival */}
      {activeSection === 2 && (
        <div className="space-y-4">
          <div><h2 className="font-semibold text-gray-800 text-sm">On arrival (as found)</h2><p className="text-xs text-gray-400 mt-0.5">Leave blank if gas not installed.</p></div>
          {arrivalRows.length === 0 ? <div className="bg-amber-50 rounded-xl px-4 py-3 text-sm text-amber-700">Please select an instrument first.</div> : (
            <>
              <BottleSelector bottles={arrivalBottles} onBottleChange={handleArrivalBottleChange} onAdd={addArrivalBottle} onRemove={removeArrivalBottle} />
              <CalTable rows={arrivalRows} onUpdate={updateArrivalMeasured} />
            </>
          )}
        </div>
      )}

      {/* Section 3: As left */}
      {activeSection === 3 && (
        <div className="space-y-4">
          <div><h2 className="font-semibold text-gray-800 text-sm">As left (after service)</h2><p className="text-xs text-gray-400 mt-0.5">Leave blank if gas not installed.</p></div>
          {asLeftRows.length === 0 ? <div className="bg-amber-50 rounded-xl px-4 py-3 text-sm text-amber-700">Please select an instrument first.</div> : (
            <>
              <BottleSelector bottles={asLeftBottles} onBottleChange={handleAsLeftBottleChange} onAdd={addAsLeftBottle} onRemove={removeAsLeftBottle} />
              <CalTable rows={asLeftRows} onUpdate={updateAsLeftMeasured} />
            </>
          )}
          {[...arrivalRows, ...asLeftRows].some(r => r.result === 'pass' || r.result === 'fail') && (
            <div className={`rounded-xl px-4 py-3 text-sm font-medium text-center ${overall === 'pass' ? 'bg-green-50 text-green-700' : overall === 'fail' ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-500'}`}>
              {overall === 'pass' ? 'Overall result: PASS' : overall === 'fail' ? 'Overall result: FAIL' : 'Overall result pending'}
            </div>
          )}
        </div>
      )}

      {/* Section 4: Service notes */}
      {activeSection === 4 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-gray-800 text-sm">Service notes</h2>
          {selectedFaults.length > 0 && (
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-500 mb-1 font-medium">Faults from picker:</p>
              <p className="text-xs text-gray-700">{selectedFaults.join(', ')}</p>
            </div>
          )}
          <div><label className="label">Additional findings</label><textarea className="input" rows={3} value={findings} onChange={e => setFindings(e.target.value)} placeholder="Any additional observations..." /></div>
          <div><label className="label">Work carried out</label><textarea className="input" rows={4} value={workDone} onChange={e => setWorkDone(e.target.value)} placeholder="Describe actions taken..." /></div>
          <div><label className="label">Recommendations</label><textarea className="input" rows={3} value={recommendations} onChange={e => setRecommendations(e.target.value)} placeholder="Any follow-up actions..." /></div>
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
                {partsLib
                  .filter(p => !partSearch || p.description.toLowerCase().includes(partSearch.toLowerCase()) || (p.part_number && p.part_number.toLowerCase().includes(partSearch.toLowerCase())))
                  .map((p: any) => (
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
              <div className="grid grid-cols-12 gap-1 text-xs text-gray-400 px-1">
                <span className="col-span-3">Description</span>
                <span className="col-span-2">Part no.</span>
                <span className="col-span-1">Qty</span>
                <span className="col-span-2">Warranty</span>
                <span className="col-span-3">Save to library</span>
                <span className="col-span-1"></span>
              </div>
              {partRows.map(row => (
                <div key={row.id} className="grid grid-cols-12 gap-1 items-center">
                  <input className="col-span-3 border border-gray-200 rounded px-2 py-1.5 text-xs" value={row.description} placeholder="Description" onChange={e => setPartRows(partRows.map(r => r.id !== row.id ? r : { ...r, description: e.target.value }))} />
                  <input className="col-span-2 border border-gray-200 rounded px-2 py-1.5 text-xs" value={row.part_number} placeholder="Part no." onChange={e => setPartRows(partRows.map(r => r.id !== row.id ? r : { ...r, part_number: e.target.value }))} />
                  <input className="col-span-1 border border-gray-200 rounded px-2 py-1.5 text-xs" type="number" min="1" value={row.quantity} onChange={e => setPartRows(partRows.map(r => r.id !== row.id ? r : { ...r, quantity: parseInt(e.target.value) || 1 }))} />
                  <select className={`col-span-2 border rounded px-1 py-1.5 text-xs ${row.warranty === 'yes' ? 'border-green-300 bg-green-50 text-green-700' : row.warranty === 'no' ? 'border-red-200 bg-red-50 text-red-600' : 'border-gray-200'}`}
                    value={row.warranty} onChange={e => setPartRows(partRows.map(r => r.id !== row.id ? r : { ...r, warranty: e.target.value }))}>
                    <option value="">Warranty?</option><option value="yes">Yes</option><option value="no">No</option><option value="na">N/A</option>
                  </select>
                  <label className="col-span-3 flex items-center gap-1.5 text-xs cursor-pointer px-1">
                    <input type="checkbox" checked={row.save_to_library}
                      onChange={e => setPartRows(partRows.map(r => r.id !== row.id ? r : { ...r, save_to_library: e.target.checked }))}
                      className="rounded" />
                    <span className={row.save_to_library ? 'text-brand-600 font-medium' : 'text-gray-400'}>
                      {row.save_to_library ? 'Will save' : 'Save?'}
                    </span>
                  </label>
                  <button onClick={() => setPartRows(partRows.filter(r => r.id !== row.id))} className="col-span-1 text-gray-300 hover:text-red-400 text-base text-center">x</button>
                </div>
              ))}
            </div>
          )}
          <button onClick={() => setPartRows(r => [...r, emptyPart()])} className="text-xs text-brand-500 hover:underline">+ Add part manually</button>
        </div>
      )}

      {/* Section 6: Sign-off */}
      {activeSection === 6 && (
        <div className="space-y-4">
          <h2 className="font-semibold text-gray-800 text-sm">Sign-off & send</h2>
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
              <div className="flex justify-between"><span className="text-gray-500">Faults</span><span className="font-medium text-red-600">{selectedFaults.length} fault{selectedFaults.length !== 1 ? 's' : ''} recorded</span></div>
            )}
            <div className="flex justify-between"><span className="text-gray-500">Email to</span><span className="font-medium">{customerEmail || '- no email set'}</span></div>
          </div>
          <div><label className="label">Engineer signature</label><SigCanvas label="Draw signature here" canvasRef={engSigRef} onSign={() => setEngSigned(true)} /></div>
          <div><label className="label">Customer signature</label><SigCanvas label="Customer signs here" canvasRef={custSigRef} onSign={() => setCustSigned(true)} /></div>
          <div><label className="label">Customer printed name</label><input className="input" value={custPrintName} onChange={e => setCustPrintName(e.target.value)} placeholder="Print name" /></div>
          {saveMsg && <div className="text-sm text-brand-600 bg-brand-50 rounded-xl px-4 py-2">{saveMsg}</div>}
          <div className="space-y-2 pt-2">
            <button onClick={() => handleSave(false, true)} disabled={saving}
              className="w-full py-3 rounded-xl border-2 border-amber-400 bg-amber-50 hover:bg-amber-100 text-amber-700 font-semibold text-sm transition-colors disabled:opacity-50">
              {saving ? 'Saving...' : '💾 Save as draft (review later)'}
            </button>
            {customerEmail && (
              <button onClick={() => handleSave(true, false)} disabled={saving}
                className="w-full py-3 rounded-xl bg-brand-500 hover:bg-brand-700 text-white font-semibold text-sm transition-colors disabled:opacity-50">
                {saving ? 'Saving...' : 'Save & email report to customer'}
              </button>
            )}
            <button onClick={() => handleSave(false, false)} disabled={saving}
              className="w-full py-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-medium text-sm transition-colors disabled:opacity-50">
              {saving ? 'Saving...' : 'Save & complete (no email)'}
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
