'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'

// ─── Types ───────────────────────────────────────────────────────────────────

interface CalRow {
  id: string
  parameter: string
  unit: string
  nominal: string          // actual value (from bottle concentration or fixed)
  nominal_type: 'from_bottle' | 'fixed'
  tolerance_type: 'fixed_abs' | 'pct_of_nominal'
  tolerance: string
  tolerance_unit: string
  tolerance_display: string
  // As Received (on arrival)
  ar_measured: string
  ar_error: string
  ar_result: 'pass' | 'fail' | 'not_installed' | ''
  // As Left (after adjustment/calibration)
  al_measured: string
  al_error: string
  al_result: 'pass' | 'fail' | 'not_installed' | ''
  // Which bottle provides the nominal (for gas rows)
  bottle_std_id: string    // id of the reference_standard used
  bottle_nominal: string   // resolved nominal from that bottle
}

interface PressureRow {
  id: string
  applied: string
  reading: string
}

interface PartRow {
  id: string
  description: string
  part_number: string
  quantity: number
  warranty: string
}

interface TempRow {
  id: string
  setPoint: string
  sprtReading: string
  displayAsFound: string
  displayAsLeft: string
}

function uid() { return Math.random().toString(36).slice(2) }
function emptyPart(): PartRow { return { id: uid(), description: '', part_number: '', quantity: 1, warranty: '' } }

// ─── Tolerance helpers ────────────────────────────────────────────────────────

function calcToleranceDisplay(row: CalRow): string {
  if (row.tolerance_type === 'fixed_abs') return `±${row.tolerance} ${row.tolerance_unit}`
  if (row.tolerance_type === 'pct_of_nominal') {
    const nom = parseFloat(row.nominal)
    if (!isNaN(nom) && nom !== 0) {
      const absVal = Math.abs(nom * parseFloat(row.tolerance) / 100)
      return `±${absVal.toFixed(4)} ${row.unit} (±${row.tolerance}%)`
    }
    return `±${row.tolerance}% of nominal`
  }
  return ''
}

function calcError(measured: string, nominal: string, toleranceType: string, tolerance: string, unit: string)
  : { error: string; result: 'pass' | 'fail' | 'not_installed' | '' } {
  if (!measured || measured.trim() === '') return { error: '', result: 'not_installed' }
  const nom = parseFloat(nominal)
  const meas = parseFloat(measured)
  if (isNaN(nom) || isNaN(meas)) return { error: '', result: '' }
  const raw = meas - nom
  let tol = 0
  if (toleranceType === 'fixed_abs') tol = parseFloat(tolerance)
  else if (toleranceType === 'pct_of_nominal') tol = Math.abs(nom * parseFloat(tolerance) / 100)
  const error = (raw >= 0 ? '+' : '') + parseFloat(raw.toFixed(6)) + ' ' + unit
  const result: 'pass' | 'fail' = Math.abs(raw) <= tol ? 'pass' : 'fail'
  return { error, result }
}

// Build CalRow[] from instrument model's gas_sensors + assigned standards
function buildCalRows(model: any, assignedStandards: any[]): CalRow[] {
  const sensors: any[] = model?.gas_sensors || []
  if (!sensors.length) return []

  // Find a matching standard for each sensor
  const gasStandards = assignedStandards.filter(s => (s.standard_types || []).includes('gas'))

  return sensors.map((s: any) => {
    const unit = s.unit || ''
    const hasFixed = s.nominal !== '' && s.nominal !== null && s.nominal !== undefined
    const nomType: 'fixed' | 'from_bottle' = hasFixed ? 'fixed' : 'from_bottle'

    // Find bottle providing this gas
    let bottleStdId = ''
    let bottleNominal = ''
    if (nomType === 'from_bottle') {
      for (const std of gasStandards) {
        const concs: any[] = std.gas_concentrations || []
        const match = concs.find((c: any) => c.gas === s.gas)
        if (match) {
          bottleStdId = std.id
          bottleNominal = String(match.concentration)
          break
        }
      }
    }

    const nominalVal = hasFixed ? String(s.nominal) : bottleNominal
    const tolType: 'fixed_abs' | 'pct_of_nominal' = s.tolerance_type === 'pct_bottle' ? 'pct_of_nominal' : 'fixed_abs'
    const tolVal = String(s.tolerance_value ?? 5)

    const row: CalRow = {
      id: uid(),
      parameter: s.gas,
      unit,
      nominal: nominalVal,
      nominal_type: nomType,
      tolerance_type: tolType,
      tolerance: tolVal,
      tolerance_unit: unit,
      tolerance_display: '',
      ar_measured: '', ar_error: '', ar_result: '',
      al_measured: '', al_error: '', al_result: '',
      bottle_std_id: bottleStdId,
      bottle_nominal: bottleNominal,
    }
    row.tolerance_display = calcToleranceDisplay(row)
    return row
  })
}

// ─── Measured input (fires on blur to avoid re-render loops) ─────────────────

function MeasuredInput({ defaultValue, onBlur, placeholder }: {
  defaultValue: string
  onBlur: (val: string) => void
  placeholder?: string
}) {
  return (
    <input type="number" step="any"
      className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white"
      defaultValue={defaultValue}
      placeholder={placeholder || 'Leave blank = N/I'}
      onBlur={e => onBlur(e.target.value)}
    />
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function NewReportPage() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const supabase     = createClient()
  const preselectedId = searchParams.get('instrument')

  // Data
  const [instruments, setInstruments]     = useState<any[]>([])
  const [partsLib, setPartsLib]           = useState<any[]>([])
  const [templates, setTemplates]         = useState<any[]>([])
  const [faultTypes, setFaultTypes]       = useState<any[]>([])
  const [commTemplates, setCommTemplates] = useState<any[]>([])
  const [profile, setProfile]             = useState<any>(null)
  const [selInstrument, setSelInstrument] = useState<any>(null)
  const [selCustomer, setSelCustomer]     = useState<any>(null)
  const [instStandards, setInstStandards] = useState<any[]>([])  // reference standards assigned to this instrument
  const [instModel, setInstModel]         = useState<any>(null)  // instrument_model record

  // Visit info
  const today = new Date()
  const [visitType, setVisitType]           = useState<'service'|'commissioning'|'calibration'|'repair'>('service')
  const [instrumentId, setInstrumentId]     = useState(preselectedId ?? '')
  const [visitDate, setVisitDate]           = useState(today.toISOString().split('T')[0])
  const [visitTime, setVisitTime]           = useState(today.toTimeString().slice(0, 5))
  const [siteLocation, setSiteLocation]     = useState('')
  const [contactName, setContactName]       = useState('')
  const [customerEmail, setCustomerEmail]   = useState('')
  const [firmware, setFirmware]             = useState('')
  const [findings, setFindings]             = useState('')
  const [workDone, setWorkDone]             = useState('')
  const [recommendations, setRecommendations] = useState('')
  const [labourHours, setLabourHours]       = useState('')
  const [custPrintName, setCustPrintName]   = useState('')
  const [sageNumber, setSageNumber]         = useState('')
  const [selectedFaults, setSelectedFaults] = useState<string[]>([])
  const [checklist, setChecklist]           = useState<any[]>([])
  const [commNotes, setCommNotes]           = useState('')
  const [photos, setPhotos]                 = useState<File[]>([])
  const [isNewUnit, setIsNewUnit]           = useState(false)
  const [certExpiry, setCertExpiry]         = useState('')

  // Gas calibration
  const [calRows, setCalRows]               = useState<CalRow[]>([])
  const [gasOverallResult, setGasOverallResult] = useState<'pass'|'fail'|''>('')

  // Pressure calibration
  const [isNewPressureUnit, setIsNewPressureUnit] = useState(false)
  const [pressureRowsAF, setPressureRowsAF] = useState<PressureRow[]>([{id:uid(),applied:'',reading:''}])
  const [pressureRowsAL, setPressureRowsAL] = useState<PressureRow[]>([{id:uid(),applied:'',reading:''}])
  const [pressurePass, setPressurePass]     = useState<'pass'|'fail'|''>('')

  // Temperature calibration
  const [tempRows, setTempRows]             = useState<TempRow[]>([
    {id:uid(),setPoint:'',sprtReading:'',displayAsFound:'',displayAsLeft:''}
  ])
  const [tempPass, setTempPass]             = useState<'pass'|'fail'|''>('')
  const [sprtCertNo, setSprtCertNo]         = useState('')
  const [sprtSerialNo, setSprtSerialNo]     = useState('')

  // Parts
  const [parts, setParts]                   = useState<PartRow[]>([])
  const [partSearch, setPartSearch]         = useState('')
  const [saving, setSaving]                 = useState(false)

  // ─── Load data on mount ──────────────────────────────────────────────────

  useEffect(() => {
    Promise.all([
      supabase.from('instruments').select('*, customers(id,name,address,city,postcode,contact_name,email), sites(id,name,address)').eq('status','active').order('customers(name)').order('serial_number'),
      supabase.from('parts_library').select('*').eq('active',true).order('description'),
      supabase.from('report_templates').select('*').eq('active',true).order('name'),
      supabase.from('fault_types').select('*').eq('active',true).order('category').order('name'),
      supabase.from('commissioning_checklists').select('*').eq('active',true).order('name'),
      supabase.from('profiles').select('*').limit(1).single(),
    ]).then(([{data:i},{data:p},{data:t},{data:f},{data:ct},{data:pr}]) => {
      setInstruments(i||[]); setPartsLib(p||[]); setTemplates(t||[])
      setFaultTypes(f||[]); setCommTemplates(ct||[]); setProfile(pr)
      if (preselectedId) handleSelectInstrument(preselectedId, i||[])
    })
  }, [])

  // ─── Instrument selection ────────────────────────────────────────────────

  async function handleSelectInstrument(id: string, instrList?: any[]) {
    setInstrumentId(id)
    setCalRows([])
    setInstStandards([])
    setInstModel(null)
    if (!id) { setSelInstrument(null); setSelCustomer(null); return }

    const list = instrList || instruments
    const inst = list.find((i: any) => i.id === id)
    if (!inst) return
    setSelInstrument(inst)
    setSelCustomer(inst.customers || null)
    if (inst.location) setSiteLocation(inst.location)
    if (inst.customers?.contact_name) setContactName(inst.customers.contact_name)
    if (inst.customers?.email)        setCustomerEmail(inst.customers.email)
    if (inst.firmware_version)        setFirmware(inst.firmware_version)

    // Load assigned standards and model in parallel
    const [{ data: stdLinks }, { data: modelData }] = await Promise.all([
      supabase
        .from('instrument_standards')
        .select('standard_id, sort_order, reference_standards(*)')
        .eq('instrument_id', id)
        .order('sort_order'),
      inst.model_id
        ? supabase.from('instrument_models').select('*').eq('id', inst.model_id).single()
        : Promise.resolve({ data: null }),
    ])

    const resolvedStandards = (stdLinks || []).map((l: any) => l.reference_standards).filter(Boolean)
    setInstStandards(resolvedStandards)
    setInstModel(modelData || null)

    // Build calibration rows from model's gas_sensors
    if (modelData && (inst.instrument_category === 'gas_analyser' || inst.instrument_category === 'portable_gas_analyser')) {
      const rows = buildCalRows(modelData, resolvedStandards)
      setCalRows(rows)
    }
  }

  // ─── Cal row updates ─────────────────────────────────────────────────────

  const updateARMeasured = useCallback((rowId: string, val: string) => {
    setCalRows(prev => prev.map(r => {
      if (r.id !== rowId) return r
      const { error, result } = calcError(val, r.nominal, r.tolerance_type, r.tolerance, r.unit)
      return { ...r, ar_measured: val, ar_error: error, ar_result: result }
    }))
  }, [])

  const updateALMeasured = useCallback((rowId: string, val: string) => {
    setCalRows(prev => prev.map(r => {
      if (r.id !== rowId) return r
      const { error, result } = calcError(val, r.nominal, r.tolerance_type, r.tolerance, r.unit)
      return { ...r, al_measured: val, al_error: error, al_result: result }
    }))
  }, [])

  // Recompute overall pass/fail whenever rows change
  useEffect(() => {
    if (!calRows.length) { setGasOverallResult(''); return }
    const results = calRows.map(r => r.al_result || r.ar_result)
    if (results.some(r => r === 'fail')) setGasOverallResult('fail')
    else if (results.every(r => r === 'pass' || r === 'not_installed')) setGasOverallResult('pass')
    else setGasOverallResult('')
  }, [calRows])

  // ─── Category flags ──────────────────────────────────────────────────────

  const isGasAnalyser   = selInstrument?.instrument_category === 'gas_analyser' || selInstrument?.instrument_category === 'portable_gas_analyser'
  const isPortable      = selInstrument?.instrument_category === 'portable_gas_analyser'
  const isPressureGauge = selInstrument?.instrument_category === 'pressure_gauge'
  const isTemperature   = selInstrument?.instrument_category === 'temperature'

  // ─── Pressure cal helpers ────────────────────────────────────────────────

  const dp = selInstrument?.decimal_places || 2
  const tol = selInstrument?.pressure_range && selInstrument?.accuracy_pct_fs
    ? (parseFloat(selInstrument.accuracy_pct_fs) * parseFloat(selInstrument.pressure_range) / 100).toFixed(dp)
    : '0'

  function addPressureRow(isAL: boolean) {
    if (isAL) setPressureRowsAL(r => [...r, {id:uid(),applied:'',reading:''}])
    else      setPressureRowsAF(r => [...r, {id:uid(),applied:'',reading:''}])
  }
  function updatePressureRow(isAL: boolean, rowId: string, field: 'applied'|'reading', val: string) {
    const setter = isAL ? setPressureRowsAL : setPressureRowsAF
    setter(prev => prev.map(r => r.id === rowId ? { ...r, [field]: val } : r))
  }

  // ─── Temperature cal helpers ─────────────────────────────────────────────

  function addTempRow() {
    setTempRows(r => [...r, {id:uid(),setPoint:'',sprtReading:'',displayAsFound:'',displayAsLeft:''}])
  }
  function updateTempRow(rowId: string, field: keyof TempRow, val: string) {
    setTempRows(prev => prev.map(r => r.id === rowId ? { ...r, [field]: val } : r))
  }

  // ─── Parts ───────────────────────────────────────────────────────────────

  function addPart() { setParts(p => [...p, emptyPart()]) }
  function updatePart(id: string, field: keyof PartRow, val: any) {
    setParts(prev => prev.map(p => p.id === id ? { ...p, [field]: val } : p))
  }
  function removePart(id: string) { setParts(prev => prev.filter(p => p.id !== id)) }
  function addPartFromLib(lib: any) {
    setParts(p => [...p, { id: uid(), description: lib.description, part_number: lib.part_number || '', quantity: 1, warranty: lib.warranty_months ? `${lib.warranty_months} months` : '' }])
  }
  const filteredParts = partsLib.filter(p => !partSearch || p.description.toLowerCase().includes(partSearch.toLowerCase()) || (p.part_number||'').toLowerCase().includes(partSearch.toLowerCase()))

  // ─── Fault toggles ───────────────────────────────────────────────────────

  function toggleFault(id: string) {
    setSelectedFaults(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }
  const faultCategories = [...new Set(faultTypes.map(f => f.category))].sort()

  // ─── Checklist ───────────────────────────────────────────────────────────

  function loadTemplate(templateId: string) {
    const t = templates.find(t => t.id === templateId)
    if (!t) return
    setChecklist((t.items || []).map((item: any) => ({ ...item, id: uid(), checked: false, note: '' })))
  }

  // ─── Photos ──────────────────────────────────────────────────────────────

  function handlePhotos(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) setPhotos(Array.from(e.target.files))
  }

  // ─── Save ────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!instrumentId) return alert('Please select an instrument.')
    setSaving(true)

    // Upload photos
    const photoUrls: string[] = []
    for (const f of photos) {
      const path = `reports/${Date.now()}-${f.name}`
      const { data } = await supabase.storage.from('report-photos').upload(path, f)
      if (data) photoUrls.push(data.path)
    }

    // Determine report_type
    let report_type = 'service'
    if (visitType === 'commissioning') report_type = 'commissioning'
    else if (visitType === 'calibration') {
      if (isGasAnalyser)   report_type = 'gas_cal'
      else if (isPressureGauge) report_type = 'pressure_cal'
      else if (isTemperature)   report_type = 'temperature_cal'
    }

    // Build calibration data payload
    const calData = isGasAnalyser ? calRows.map(r => ({
      parameter:      r.parameter,
      unit:           r.unit,
      nominal:        r.nominal,
      tolerance:      r.tolerance,
      tolerance_type: r.tolerance_type,
      tolerance_display: r.tolerance_display,
      bottle_std_id:  r.bottle_std_id,
      ar_measured:    r.ar_measured,
      ar_error:       r.ar_error,
      ar_result:      r.ar_result,
      al_measured:    r.al_measured,
      al_error:       r.al_error,
      al_result:      r.al_result,
    })) : null

    const { data: report, error } = await supabase.from('reports').insert({
      instrument_id:  instrumentId,
      customer_id:    selCustomer?.id || null,
      report_type,
      visit_type:     visitType,
      visit_date:     visitDate,
      visit_time:     visitTime,
      site_location:  siteLocation || null,
      contact_name:   contactName || null,
      customer_email: customerEmail || null,
      firmware_version: firmware || null,
      findings:       findings || null,
      work_done:      workDone || null,
      recommendations: recommendations || null,
      labour_hours:   labourHours ? parseFloat(labourHours) : null,
      cust_print_name: custPrintName || null,
      sage_number:    sageNumber || null,
      fault_ids:      selectedFaults.length ? selectedFaults : null,
      checklist:      checklist.length ? checklist : null,
      commissioning_notes: commNotes || null,
      photo_urls:     photoUrls.length ? photoUrls : null,
      is_new_unit:    isNewUnit,
      cert_expiry:    certExpiry || null,
      // Calibration
      cal_data:       calData,
      gas_overall_result: isGasAnalyser ? (gasOverallResult || null) : null,
      pressure_rows_af: isPressureGauge ? pressureRowsAF : null,
      pressure_rows_al: isPressureGauge ? pressureRowsAL : null,
      pressure_pass:  isPressureGauge ? (pressurePass || null) : null,
      temp_rows:      isTemperature ? tempRows : null,
      temp_pass:      isTemperature ? (tempPass || null) : null,
      sprt_cert_no:   isTemperature ? (sprtCertNo || null) : null,
      sprt_serial_no: isTemperature ? (sprtSerialNo || null) : null,
      parts:          parts.length ? parts : null,
      status: 'draft',
    }).select('id').single()

    setSaving(false)
    if (error) { alert(error.message); return }
    router.push(`/dashboard/reports/${report?.id}`)
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <div className="text-xs text-gray-400 mb-1">
          <a href="/dashboard/reports" className="hover:text-brand-500">Reports</a> / New
        </div>
        <h1 className="text-2xl font-semibold text-gray-900">New report</h1>
      </div>

      <div className="space-y-5">

        {/* ── Visit type ── */}
        <div className="card p-5 space-y-3">
          <h2 className="font-medium text-gray-700 text-sm uppercase tracking-wide">Visit type</h2>
          <div className="grid grid-cols-4 gap-2">
            {(['service','calibration','commissioning','repair'] as const).map(vt => (
              <button key={vt} onClick={() => setVisitType(vt)}
                className={`py-2.5 px-3 rounded-xl border-2 text-xs font-medium capitalize transition-colors ${visitType === vt ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'}`}>
                {vt}
              </button>
            ))}
          </div>
        </div>

        {/* ── Instrument ── */}
        <div className="card p-5 space-y-3">
          <h2 className="font-medium text-gray-700 text-sm uppercase tracking-wide">Instrument</h2>
          <select className="input" value={instrumentId} onChange={e => handleSelectInstrument(e.target.value)}>
            <option value="">Select instrument...</option>
            {instruments.map(i => (
              <option key={i.id} value={i.id}>
                {i.customers?.name} — {i.name} {i.make} {i.model} {i.serial_number ? `(S/N: ${i.serial_number})` : ''}
              </option>
            ))}
          </select>

          {selInstrument && (
            <div className="bg-gray-50 rounded-xl p-4 text-xs space-y-1 mt-2">
              <div className="flex justify-between"><span className="text-gray-500">Customer</span><span className="font-medium">{selCustomer?.name}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Type</span><span className="font-medium">{selInstrument.name}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Make / model</span><span className="font-medium">{selInstrument.make} {selInstrument.model}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Serial number</span><span className="font-mono font-medium">{selInstrument.serial_number || '—'}</span></div>
              {instModel && (
                <div className="flex justify-between"><span className="text-gray-500">Model template</span><span className="font-medium">{instModel.make} {instModel.model}</span></div>
              )}
              {isPressureGauge && (
                <>
                  <div className="flex justify-between"><span className="text-gray-500">Range</span><span className="font-mono font-medium">{selInstrument.vacuum_range ? selInstrument.vacuum_range + ' to ' : '0 to '}{selInstrument.pressure_range} {selInstrument.pressure_unit}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Accuracy</span><span className="font-mono font-medium">±{selInstrument.accuracy_pct_fs}% FS (±{tol} {selInstrument.pressure_unit})</span></div>
                </>
              )}
              {isTemperature && (
                <>
                  <div className="flex justify-between"><span className="text-gray-500">Range</span><span className="font-mono font-medium">{selInstrument.temp_range_min} to {selInstrument.temp_range_max} °C</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Accuracy</span><span className="font-mono font-medium">±{selInstrument.temp_accuracy_value} {selInstrument.temp_accuracy_type === 'celsius' ? '°C' : selInstrument.temp_accuracy_type === 'pct_fs' ? '% FS' : '% RDG'}</span></div>
                </>
              )}
              {instStandards.length > 0 && (
                <div className="pt-1 mt-1 border-t border-gray-200">
                  <div className="text-gray-500 mb-1">Assigned reference standards:</div>
                  {instStandards.map((s: any) => (
                    <div key={s.id} className="text-gray-700 font-medium">• {s.description} {s.serial_number ? `(S/N: ${s.serial_number})` : ''}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Visit info ── */}
        <div className="card p-5 space-y-3">
          <h2 className="font-medium text-gray-700 text-sm uppercase tracking-wide">Visit information</h2>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Visit date</label><input className="input" type="date" value={visitDate} onChange={e => setVisitDate(e.target.value)} /></div>
            <div><label className="label">Visit time</label><input className="input" type="time" value={visitTime} onChange={e => setVisitTime(e.target.value)} /></div>
          </div>
          <div><label className="label">Site / location</label><input className="input" value={siteLocation} onChange={e => setSiteLocation(e.target.value)} /></div>
          <div><label className="label">Contact person</label><input className="input" value={contactName} onChange={e => setContactName(e.target.value)} /></div>
          <div><label className="label">Customer email</label><input className="input" type="email" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} /></div>
          {!isPressureGauge && !isTemperature && <div><label className="label">Firmware version</label><input className="input" value={firmware} onChange={e => setFirmware(e.target.value)} /></div>}
          <div><label className="label">Sage sales number</label><input className="input" value={sageNumber} onChange={e => setSageNumber(e.target.value)} /></div>
          {(isPressureGauge || isTemperature) && <div><label className="label">Certificate expiry date</label><input className="input" type="date" value={certExpiry} onChange={e => setCertExpiry(e.target.value)} /></div>}
        </div>

        {/* ── CALIBRATION TABLE (gas analysers) ── */}
        {visitType === 'calibration' && isGasAnalyser && (
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-medium text-gray-700 text-sm uppercase tracking-wide">Calibration</h2>
              {gasOverallResult && (
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${gasOverallResult === 'pass' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {gasOverallResult.toUpperCase()}
                </span>
              )}
            </div>

            {isPortable && (
              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-600">New unit (first calibration — As Left only)?</label>
                <button onClick={() => setIsNewUnit(!isNewUnit)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${isNewUnit ? 'bg-brand-500 text-white border-brand-500' : 'bg-white text-gray-600 border-gray-300'}`}>
                  {isNewUnit ? 'Yes — As Left only' : 'No — As Received + As Left'}
                </button>
              </div>
            )}

            {!instModel && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700">
                ⚠️ No model linked to this instrument. <a href={`/dashboard/instruments/${selInstrument?.id}/edit`} className="underline">Link a model</a> to auto-populate parameters.
              </div>
            )}

            {instStandards.filter(s => (s.standard_types||[]).includes('gas')).length === 0 && instModel && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700">
                ⚠️ No gas reference standards assigned to this instrument. <a href={`/dashboard/instruments/${selInstrument?.id}/edit`} className="underline">Assign standards</a> so nominal values auto-populate.
              </div>
            )}

            {calRows.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left p-2 font-medium text-gray-600 border border-gray-200 w-20">Gas</th>
                      <th className="text-left p-2 font-medium text-gray-600 border border-gray-200 w-14">Unit</th>
                      <th className="text-left p-2 font-medium text-gray-600 border border-gray-200 w-24">Nominal</th>
                      <th className="text-left p-2 font-medium text-gray-600 border border-gray-200 w-28">Tolerance</th>
                      {!isNewUnit && (
                        <>
                          <th className="text-center p-2 font-medium text-blue-600 border border-gray-200 bg-blue-50 w-24">As Received</th>
                          <th className="text-center p-2 font-medium text-blue-600 border border-gray-200 bg-blue-50 w-24">Error (AR)</th>
                          <th className="text-center p-2 font-medium text-blue-600 border border-gray-200 bg-blue-50 w-16">Result (AR)</th>
                        </>
                      )}
                      <th className="text-center p-2 font-medium text-green-600 border border-gray-200 bg-green-50 w-24">As Left</th>
                      <th className="text-center p-2 font-medium text-green-600 border border-gray-200 bg-green-50 w-24">Error (AL)</th>
                      <th className="text-center p-2 font-medium text-green-600 border border-gray-200 bg-green-50 w-16">Result (AL)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calRows.map(row => (
                      <tr key={row.id} className="hover:bg-gray-50">
                        <td className="p-2 border border-gray-200 font-medium">{row.parameter}</td>
                        <td className="p-2 border border-gray-200 text-gray-500">{row.unit}</td>
                        <td className="p-2 border border-gray-200 font-mono">
                          {row.nominal || <span className="text-amber-500 italic text-xs">No bottle</span>}
                          {row.nominal_type === 'from_bottle' && row.nominal && (
                            <span className="text-gray-400 text-xs ml-1">(bottle)</span>
                          )}
                        </td>
                        <td className="p-2 border border-gray-200 text-gray-500 font-mono text-xs">{row.tolerance_display}</td>
                        {!isNewUnit && (
                          <>
                            <td className="p-2 border border-gray-200 bg-blue-50/40">
                              <MeasuredInput defaultValue={row.ar_measured} onBlur={val => updateARMeasured(row.id, val)} />
                            </td>
                            <td className="p-2 border border-gray-200 bg-blue-50/40 font-mono text-center">
                              {row.ar_error || (row.ar_result === 'not_installed' ? <span className="text-gray-400">N/I</span> : '—')}
                            </td>
                            <td className="p-2 border border-gray-200 bg-blue-50/40 text-center">
                              {row.ar_result === 'pass' && <span className="text-green-600 font-bold">PASS</span>}
                              {row.ar_result === 'fail' && <span className="text-red-600 font-bold">FAIL</span>}
                              {row.ar_result === 'not_installed' && <span className="text-gray-400">N/I</span>}
                            </td>
                          </>
                        )}
                        <td className="p-2 border border-gray-200 bg-green-50/40">
                          <MeasuredInput defaultValue={row.al_measured} onBlur={val => updateALMeasured(row.id, val)} />
                        </td>
                        <td className="p-2 border border-gray-200 bg-green-50/40 font-mono text-center">
                          {row.al_error || (row.al_result === 'not_installed' ? <span className="text-gray-400">N/I</span> : '—')}
                        </td>
                        <td className="p-2 border border-gray-200 bg-green-50/40 text-center">
                          {row.al_result === 'pass' && <span className="text-green-600 font-bold">PASS</span>}
                          {row.al_result === 'fail' && <span className="text-red-600 font-bold">FAIL</span>}
                          {row.al_result === 'not_installed' && <span className="text-gray-400">N/I</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : selInstrument ? (
              <div className="text-sm text-gray-400 italic py-4 text-center">
                No calibration parameters — link a model with gas sensors to this instrument.
              </div>
            ) : null}

            {/* Reference standards used */}
            {instStandards.length > 0 && (
              <div className="mt-2 pt-3 border-t border-gray-100">
                <div className="text-xs text-gray-500 font-medium mb-1">Reference standards used:</div>
                <div className="flex flex-wrap gap-2">
                  {instStandards.map((s: any) => (
                    <span key={s.id} className="inline-flex items-center px-2 py-1 rounded-lg bg-gray-100 text-xs text-gray-700">
                      {s.description}{s.serial_number ? ` · ${s.serial_number}` : ''}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Overall result override */}
            {calRows.length > 0 && (
              <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
                <span className="text-sm text-gray-600">Override overall result:</span>
                {(['pass','fail'] as const).map(r => (
                  <button key={r} onClick={() => setGasOverallResult(gasOverallResult === r ? '' : r)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium border transition-colors ${gasOverallResult === r ? (r === 'pass' ? 'bg-green-500 text-white border-green-500' : 'bg-red-500 text-white border-red-500') : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
                    {r.toUpperCase()}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── CALIBRATION (pressure gauge) ── */}
        {visitType === 'calibration' && isPressureGauge && selInstrument && (
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-medium text-gray-700 text-sm uppercase tracking-wide">Pressure calibration</h2>
              {pressurePass && (
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${pressurePass === 'pass' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {pressurePass.toUpperCase()}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-600">New unit?</label>
              <button onClick={() => setIsNewPressureUnit(!isNewPressureUnit)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${isNewPressureUnit ? 'bg-brand-500 text-white border-brand-500' : 'bg-white text-gray-600 border-gray-300'}`}>
                {isNewPressureUnit ? 'Yes' : 'No'}
              </button>
            </div>

            {/* Reference standards */}
            {instStandards.length > 0 && (
              <div className="bg-gray-50 rounded-xl p-3 text-xs space-y-1">
                <div className="font-medium text-gray-600">Reference standards:</div>
                {instStandards.map((s: any) => (
                  <div key={s.id} className="text-gray-700">• {s.description} {s.serial_number ? `(S/N: ${s.serial_number})` : ''}</div>
                ))}
              </div>
            )}

            {!isNewPressureUnit && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-blue-700">As Received (on arrival)</h3>
                  <button onClick={() => addPressureRow(false)} className="text-xs text-brand-500 hover:underline">+ Add point</button>
                </div>
                <table className="w-full text-xs border-collapse">
                  <thead><tr className="bg-blue-50">
                    <th className="text-left p-2 font-medium text-gray-600 border border-gray-200">Applied ({selInstrument.pressure_unit})</th>
                    <th className="text-left p-2 font-medium text-gray-600 border border-gray-200">Reading ({selInstrument.pressure_unit})</th>
                  </tr></thead>
                  <tbody>
                    {pressureRowsAF.map(r => (
                      <tr key={r.id}>
                        <td className="p-1.5 border border-gray-200"><input className="input text-xs" type="number" step="any" value={r.applied} onChange={e => updatePressureRow(false, r.id, 'applied', e.target.value)} /></td>
                        <td className="p-1.5 border border-gray-200"><input className="input text-xs" type="number" step="any" value={r.reading} onChange={e => updatePressureRow(false, r.id, 'reading', e.target.value)} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-green-700">As Left (after calibration)</h3>
                <button onClick={() => addPressureRow(true)} className="text-xs text-brand-500 hover:underline">+ Add point</button>
              </div>
              <table className="w-full text-xs border-collapse">
                <thead><tr className="bg-green-50">
                  <th className="text-left p-2 font-medium text-gray-600 border border-gray-200">Applied ({selInstrument.pressure_unit})</th>
                  <th className="text-left p-2 font-medium text-gray-600 border border-gray-200">Reading ({selInstrument.pressure_unit})</th>
                </tr></thead>
                <tbody>
                  {pressureRowsAL.map(r => (
                    <tr key={r.id}>
                      <td className="p-1.5 border border-gray-200"><input className="input text-xs" type="number" step="any" value={r.applied} onChange={e => updatePressureRow(true, r.id, 'applied', e.target.value)} /></td>
                      <td className="p-1.5 border border-gray-200"><input className="input text-xs" type="number" step="any" value={r.reading} onChange={e => updatePressureRow(true, r.id, 'reading', e.target.value)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
              <span className="text-sm text-gray-600">Overall result:</span>
              {(['pass','fail'] as const).map(r => (
                <button key={r} onClick={() => setPressurePass(pressurePass === r ? '' : r)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium border transition-colors ${pressurePass === r ? (r === 'pass' ? 'bg-green-500 text-white border-green-500' : 'bg-red-500 text-white border-red-500') : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
                  {r.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── CALIBRATION (temperature) ── */}
        {visitType === 'calibration' && isTemperature && selInstrument && (
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-medium text-gray-700 text-sm uppercase tracking-wide">Temperature calibration</h2>
              {tempPass && (
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${tempPass === 'pass' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {tempPass.toUpperCase()}
                </span>
              )}
            </div>

            {/* Reference standards */}
            {instStandards.length > 0 && (
              <div className="bg-gray-50 rounded-xl p-3 text-xs space-y-1">
                <div className="font-medium text-gray-600">Reference standards:</div>
                {instStandards.map((s: any) => (
                  <div key={s.id} className="text-gray-700">• {s.description} {s.serial_number ? `(S/N: ${s.serial_number})` : ''}</div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">SPRT certificate No.</label><input className="input" value={sprtCertNo} onChange={e => setSprtCertNo(e.target.value)} /></div>
              <div><label className="label">SPRT serial No.</label><input className="input" value={sprtSerialNo} onChange={e => setSprtSerialNo(e.target.value)} /></div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-700">Calibration points</h3>
                <button onClick={addTempRow} className="text-xs text-brand-500 hover:underline">+ Add point</button>
              </div>
              <table className="w-full text-xs border-collapse">
                <thead><tr className="bg-gray-50">
                  <th className="text-left p-2 font-medium text-gray-600 border border-gray-200">Set point (°C)</th>
                  <th className="text-left p-2 font-medium text-gray-600 border border-gray-200">SPRT reading (°C)</th>
                  <th className="text-left p-2 font-medium text-blue-600 border border-gray-200 bg-blue-50">Display as found (°C)</th>
                  <th className="text-left p-2 font-medium text-green-600 border border-gray-200 bg-green-50">Display as left (°C)</th>
                </tr></thead>
                <tbody>
                  {tempRows.map(r => (
                    <tr key={r.id}>
                      <td className="p-1.5 border border-gray-200"><input className="input text-xs" type="number" step="any" value={r.setPoint} onChange={e => updateTempRow(r.id, 'setPoint', e.target.value)} /></td>
                      <td className="p-1.5 border border-gray-200"><input className="input text-xs" type="number" step="any" value={r.sprtReading} onChange={e => updateTempRow(r.id, 'sprtReading', e.target.value)} /></td>
                      <td className="p-1.5 border border-gray-200 bg-blue-50/40"><input className="input text-xs" type="number" step="any" value={r.displayAsFound} onChange={e => updateTempRow(r.id, 'displayAsFound', e.target.value)} /></td>
                      <td className="p-1.5 border border-gray-200 bg-green-50/40"><input className="input text-xs" type="number" step="any" value={r.displayAsLeft} onChange={e => updateTempRow(r.id, 'displayAsLeft', e.target.value)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
              <span className="text-sm text-gray-600">Overall result:</span>
              {(['pass','fail'] as const).map(r => (
                <button key={r} onClick={() => setTempPass(tempPass === r ? '' : r)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium border transition-colors ${tempPass === r ? (r === 'pass' ? 'bg-green-500 text-white border-green-500' : 'bg-red-500 text-white border-red-500') : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
                  {r.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Commissioning checklist ── */}
        {visitType === 'commissioning' && (
          <div className="card p-5 space-y-3">
            <h2 className="font-medium text-gray-700 text-sm uppercase tracking-wide">Commissioning checklist</h2>
            <div>
              <label className="label">Load template</label>
              <select className="input" onChange={e => loadTemplate(e.target.value)}>
                <option value="">Select template...</option>
                {commTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            {checklist.length > 0 && (
              <div className="space-y-2 mt-2">
                {checklist.map((item, i) => (
                  <div key={item.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                    <input type="checkbox" checked={item.checked} onChange={() => setChecklist(prev => prev.map((c, ci) => ci === i ? { ...c, checked: !c.checked } : c))} className="mt-0.5 accent-brand-500" />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-800">{item.name || item.label}</div>
                      <input className="input mt-1 text-xs" placeholder="Notes..." value={item.note} onChange={e => setChecklist(prev => prev.map((c, ci) => ci === i ? { ...c, note: e.target.value } : c))} />
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div><label className="label">Commissioning notes</label><textarea className="input" rows={3} value={commNotes} onChange={e => setCommNotes(e.target.value)} /></div>
          </div>
        )}

        {/* ── Findings & work ── */}
        <div className="card p-5 space-y-3">
          <h2 className="font-medium text-gray-700 text-sm uppercase tracking-wide">Findings & work done</h2>
          <div>
            <label className="label">Findings / faults found</label>
            <textarea className="input" rows={4} value={findings} onChange={e => setFindings(e.target.value)} placeholder="Describe what was found..." />
          </div>
          <div>
            <label className="label">Work done</label>
            <textarea className="input" rows={4} value={workDone} onChange={e => setWorkDone(e.target.value)} placeholder="Describe work carried out..." />
          </div>
          <div>
            <label className="label">Recommendations</label>
            <textarea className="input" rows={3} value={recommendations} onChange={e => setRecommendations(e.target.value)} />
          </div>
        </div>

        {/* ── Fault types ── */}
        {faultTypes.length > 0 && (
          <div className="card p-5 space-y-3">
            <h2 className="font-medium text-gray-700 text-sm uppercase tracking-wide">Fault types</h2>
            {faultCategories.map(cat => (
              <div key={cat}>
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">{cat}</div>
                <div className="flex flex-wrap gap-2">
                  {faultTypes.filter(f => f.category === cat).map(f => (
                    <button key={f.id} type="button" onClick={() => toggleFault(f.id)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${selectedFaults.includes(f.id) ? 'bg-red-100 text-red-700 border-red-300' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
                      {f.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Parts used ── */}
        <div className="card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-gray-700 text-sm uppercase tracking-wide">Parts used</h2>
            <button onClick={addPart} className="text-xs text-brand-500 hover:underline">+ Add part</button>
          </div>
          {partsLib.length > 0 && (
            <div>
              <label className="label">Search parts library</label>
              <input className="input" placeholder="Search..." value={partSearch} onChange={e => setPartSearch(e.target.value)} />
              {partSearch && (
                <div className="mt-1 border border-gray-200 rounded-xl divide-y divide-gray-100 max-h-40 overflow-y-auto">
                  {filteredParts.slice(0,8).map(p => (
                    <button key={p.id} type="button" onClick={() => { addPartFromLib(p); setPartSearch('') }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex justify-between">
                      <span>{p.description}</span>
                      {p.part_number && <span className="text-gray-400">{p.part_number}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {parts.length > 0 && (
            <table className="w-full text-xs border-collapse mt-2">
              <thead><tr className="bg-gray-50">
                <th className="text-left p-2 font-medium text-gray-600 border border-gray-200">Description</th>
                <th className="text-left p-2 font-medium text-gray-600 border border-gray-200 w-28">Part No.</th>
                <th className="text-left p-2 font-medium text-gray-600 border border-gray-200 w-16">Qty</th>
                <th className="text-left p-2 font-medium text-gray-600 border border-gray-200 w-24">Warranty</th>
                <th className="p-2 border border-gray-200 w-10"></th>
              </tr></thead>
              <tbody>
                {parts.map(p => (
                  <tr key={p.id}>
                    <td className="p-1.5 border border-gray-200"><input className="input text-xs" value={p.description} onChange={e => updatePart(p.id,'description',e.target.value)} /></td>
                    <td className="p-1.5 border border-gray-200"><input className="input text-xs" value={p.part_number} onChange={e => updatePart(p.id,'part_number',e.target.value)} /></td>
                    <td className="p-1.5 border border-gray-200"><input className="input text-xs" type="number" min={1} value={p.quantity} onChange={e => updatePart(p.id,'quantity',parseInt(e.target.value))} /></td>
                    <td className="p-1.5 border border-gray-200"><input className="input text-xs" value={p.warranty} onChange={e => updatePart(p.id,'warranty',e.target.value)} placeholder="e.g. 12 months" /></td>
                    <td className="p-1.5 border border-gray-200 text-center"><button onClick={() => removePart(p.id)} className="text-red-400 hover:text-red-600 text-xs">✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Labour & sign-off ── */}
        <div className="card p-5 space-y-3">
          <h2 className="font-medium text-gray-700 text-sm uppercase tracking-wide">Labour & sign-off</h2>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Labour hours</label><input className="input" type="number" step="0.5" min={0} value={labourHours} onChange={e => setLabourHours(e.target.value)} /></div>
            <div><label className="label">Customer print name</label><input className="input" value={custPrintName} onChange={e => setCustPrintName(e.target.value)} /></div>
          </div>
        </div>

        {/* ── Photos ── */}
        <div className="card p-5 space-y-3">
          <h2 className="font-medium text-gray-700 text-sm uppercase tracking-wide">Photos</h2>
          <input type="file" accept="image/*" multiple onChange={handlePhotos} className="text-sm text-gray-600" />
          {photos.length > 0 && <div className="text-xs text-gray-500">{photos.length} photo{photos.length > 1 ? 's' : ''} selected</div>}
        </div>

        {/* ── Save ── */}
        <div className="flex gap-3 pb-10">
          <button onClick={handleSave} disabled={saving || !instrumentId} className="btn-primary">
            {saving ? 'Saving...' : 'Save report'}
          </button>
          <button onClick={() => router.back()} className="btn-secondary">Cancel</button>
        </div>

      </div>
    </div>
  )
}
