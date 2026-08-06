'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'

interface PressureRow {
  id: string
  applied: string
  reading: string
}

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
}

interface SelectedBottle { uid: string; stdId: string }

interface TempRow {
  id: string
  setPoint: string
  sprtReading: string
  displayAsFound: string
  displayAsLeft: string
}

function uid() { return Math.random().toString(36).slice(2) }
function emptyPart(): PartRow { return { id: uid(), description: '', part_number: '', quantity: 1, warranty: '' } }

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

function calcGasError(row: CalRow): { error: string; result: 'pass' | 'fail' | 'not_installed' | '' } {
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
      defaultValue={row.measured} placeholder="Leave blank = Not installed"
      onBlur={e => onUpdate(row.id, e.target.value)} />
  )
}

export default function NewReportPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const preselectedId = searchParams.get('instrument')

  const [instruments, setInstruments]   = useState<any[]>([])
  const [standards, setStandards]       = useState<any[]>([])
  const [partsLib, setPartsLib]         = useState<any[]>([])
  const [templates, setTemplates]       = useState<any[]>([])
  const [faultTypes, setFaultTypes]     = useState<any[]>([])
  const [commTemplates, setCommTemplates] = useState<any[]>([])
  const [profile, setProfile]           = useState<any>(null)
  const [selInstrument, setSelInstrument] = useState<any>(null)
  const [selCustomer, setSelCustomer]   = useState<any>(null)

  const today = new Date()
  const [visitType, setVisitType]       = useState<'service'|'commissioning'|'calibration'|'repair'>('service')
  const [instrumentId, setInstrumentId] = useState(preselectedId ?? '')
  const [visitDate, setVisitDate]       = useState(today.toISOString().split('T')[0])
  const [visitTime, setVisitTime]       = useState(today.toTimeString().slice(0, 5))
  const [siteLocation, setSiteLocation] = useState('')
  const [contactName, setContactName]   = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [firmware, setFirmware]         = useState('')
  const [findings, setFindings]         = useState('')
  const [workDone, setWorkDone]         = useState('')
  const [recommendations, setRecommendations] = useState('')
  const [labourHours, setLabourHours]   = useState('')
  const [custPrintName, setCustPrintName] = useState('')
  const [sageNumber, setSageNumber]     = useState('')
  const [selectedFaults, setSelectedFaults] = useState<string[]>([])
  const [checklist, setChecklist]       = useState<any[]>([])
  const [commNotes, setCommNotes]       = useState('')
  const [photos, setPhotos]             = useState<File[]>([])
  const [photoUrls, setPhotoUrls]       = useState<string[]>([])

  // Gas calibration
  const [arrivalRows, setArrivalRows]   = useState<CalRow[]>([])
  const [asLeftRows, setAsLeftRows]     = useState<CalRow[]>([])
  const [arrivalBottles, setArrivalBottles] = useState<SelectedBottle[]>([{ uid: uid(), stdId: '' }])
  const [asLeftBottles, setAsLeftBottles]   = useState<SelectedBottle[]>([{ uid: uid(), stdId: '' }])

  // Pressure calibration
  const [isNewUnit, setIsNewUnit]       = useState(false)
  const [asReceivedRows, setAsReceivedRows] = useState<PressureRow[]>([])
  const [afterAdjRows, setAfterAdjRows] = useState<PressureRow[]>([])
  const [pressureRefId, setPressureRefId] = useState('')
  const [tempC, setTempC]               = useState('23')
  const [media, setMedia]               = useState('Air')
  const [orientation, setOrientation]   = useState('Vertical Position')
  const [procedure, setProcedure]       = useState('IS-09-07-01')
  const [zeroedBefore, setZeroedBefore] = useState(true)
  const [certExpiry, setCertExpiry]     = useState('')
  const [basisOfTolerance, setBasisOfTolerance] = useState('Manufacturer Specification')

  // Temperature calibration
  const [tempRows, setTempRows]           = useState<TempRow[]>([])
  const [tempRefId, setTempRefId]         = useState('')
  const [tempBoreSize, setTempBoreSize]   = useState('6.35')
  const [tempZone, setTempZone]           = useState('Bottom')
  const [tempStabilityNote, setTempStabilityNote] = useState('')
  const [isNewTempUnit, setIsNewTempUnit] = useState(false)

  const [partRows, setPartRows]         = useState<PartRow[]>([])
  const [showPartPicker, setShowPartPicker] = useState(false)
  const [partSearch, setPartSearch]     = useState('')
  const [activeSection, setActiveSection] = useState(0)
  const [saving, setSaving]             = useState(false)
  const [saveMsg, setSaveMsg]           = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      const [{ data: prof }, { data: insts }, { data: stds }, { data: parts }, { data: tmpls }, { data: faults }, { data: commTmpls }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user!.id).single(),
        supabase.from('instruments').select('*, customer:customers(*), site:sites(*)').eq('status', 'active').order('name'),
        supabase.from('reference_standards').select('*').eq('active', true).order('description'),
        supabase.from('parts_library').select('*').eq('active', true).order('description'),
        supabase.from('cal_templates').select('*').eq('active', true).order('name'),
        supabase.from('fault_types').select('*').eq('active', true).order('sort_order'),
        supabase.from('commissioning_templates').select('*').eq('active', true).order('name'),
      ])
      setProfile(prof); setInstruments(insts || []); setStandards(stds || [])
      setPartsLib(parts || []); setTemplates(tmpls || []); setFaultTypes(faults || [])
      setCommTemplates(commTmpls || [])
      if (preselectedId && insts) {
        const inst = insts.find((i: any) => i.id === preselectedId)
        if (inst) doSelectInstrument(inst, tmpls || [])
      }
    }
    load()
  }, [])

  const isPressureGauge = selInstrument?.instrument_category === 'pressure_gauge'
  const isTemperature = selInstrument?.instrument_category === 'temperature'

  function generatePoints(inst?: any): PressureRow[] {
    const instrument = inst || selInstrument
    if (!instrument) return []
    const range = parseFloat(instrument.pressure_range) || 0
    const vac = parseFloat(instrument.vacuum_range) || 0
    const dp = instrument.decimal_places || 2
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
    return points.map(p => ({ id: uid(), applied: p.toFixed(dp), reading: '' }))
  }

  function doSelectInstrument(inst: any, tmpls?: any[]) {
    setSelInstrument(inst); setInstrumentId(inst.id)
    setFirmware(inst.firmware_version ?? '')
    const cust = inst.customer; const site = inst.site
    if (cust) { setSelCustomer(cust); setContactName(cust.contact_name ?? ''); setCustomerEmail(cust.contact_email ?? '') }
    if (site) setSiteLocation([site.name, site.address, site.city, site.postcode].filter(Boolean).join(', '))
    if (inst.instrument_category === 'temperature') {
      const min = parseFloat(inst.temp_range_min) || 0
      const max = parseFloat(inst.temp_range_max) || 100
      const res = parseFloat(inst.temp_display_resolution) || 0.1
      const dp = res < 0.1 ? 2 : res < 1 ? 1 : 0
      // Generate 5 default points
      const range = max - min
      const pts = [
        min,
        parseFloat((min + range * 0.25).toFixed(dp)),
        parseFloat((min + range * 0.5).toFixed(dp)),
        parseFloat((min + range * 0.75).toFixed(dp)),
        max
      ]
      setTempRows(pts.map(p => ({ id: uid(), setPoint: p.toFixed(dp), sprtReading: '', displayAsFound: '', displayAsLeft: '' })))
      const expiry = new Date(); expiry.setMonth(expiry.getMonth() + 12)
      setCertExpiry(expiry.toISOString().split('T')[0])
    } else if (inst.instrument_category === 'pressure_gauge') {
      const expiry = new Date(); expiry.setMonth(expiry.getMonth() + 12)
      setCertExpiry(expiry.toISOString().split('T')[0])
      const pts = generatePoints(inst)
      setAsReceivedRows(pts)
      setAfterAdjRows(pts.map(r => ({ ...r, id: uid(), reading: '' })))
    } else {
      const availableTemplates = tmpls || templates
      if (availableTemplates.length > 0) doLoadTemplate(availableTemplates[0])
    }
  }

  function calcPressureError(applied: string, reading: string, inst?: any) {
    const instrument = inst || selInstrument
    if (!reading || !applied || !instrument) return { error: '', errorPct: '', errorPctTol: '', result: '' }
    const a = parseFloat(applied)
    const r = parseFloat(reading)
    const range = parseFloat(instrument.pressure_range)
    const acc = parseFloat(instrument.accuracy_pct_fs)
    const dp = instrument.decimal_places || 2
    if (isNaN(a) || isNaN(r) || isNaN(range) || isNaN(acc)) return { error: '', errorPct: '', errorPctTol: '', result: '' }
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

  function autoRound(val: string, dp: number): string {
    const n = parseFloat(val)
    if (isNaN(n)) return val
    return n.toFixed(dp)
  }

  function calcTempError(displayReading: string, sprtReading: string) {
    if (!displayReading || !sprtReading || !selInstrument) return { error: '', result: '' }
    const disp = parseFloat(displayReading)
    const sprt = parseFloat(sprtReading)
    if (isNaN(disp) || isNaN(sprt)) return { error: '', result: '' }
    const err = disp - sprt
    const acc = parseFloat(selInstrument.temp_accuracy_value) || 0.5
    const accType = selInstrument.temp_accuracy_type || 'celsius'
    let tol = acc
    if (accType === 'pct_fs') {
      const range = (parseFloat(selInstrument.temp_range_max) || 100) - (parseFloat(selInstrument.temp_range_min) || 0)
      tol = acc * range / 100
    } else if (accType === 'pct_rdg') {
      tol = Math.abs(parseFloat(sprtReading)) * acc / 100
    }
    return {
      error: (err >= 0 ? '+' : '') + parseFloat(err.toFixed(4)).toString(),
      result: Math.abs(err) <= tol ? 'PASS' : 'FAIL'
    }
  }

  function tempOverallResult(): 'pass' | 'fail' | 'na' {
    const results = tempRows.filter(r => r.displayAsLeft && r.sprtReading)
      .map(r => calcTempError(r.displayAsLeft, r.sprtReading).result)
    if (!results.length) return 'na'
    return results.some(r => r === 'FAIL') ? 'fail' : 'pass'
  }

  function pressureOverallResult(rows: PressureRow[]): 'pass' | 'fail' | 'na' {
    const results = rows.filter(r => r.reading).map(r => calcPressureError(r.applied, r.reading).result)
    if (!results.length) return 'na'
    return results.some(r => r === 'FAIL') ? 'fail' : 'pass'
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
  }

  function applyBottleToRows(rows: CalRow[], stdId: string): CalRow[] {
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
    let result = rows.map(r => r.nominal_type === 'from_bottle' ? { ...r, nominal: '', unit: '', bottle_used: '', tolerance_display: '' } : r)
    bottles.forEach(b => { if (b.stdId) result = applyBottleToRows(result, b.stdId) })
    return result
  }

  function handleArrivalBottleChange(buid: string, newStdId: string) {
    const updated = arrivalBottles.map(b => b.uid === buid ? { ...b, stdId: newStdId } : b)
    setArrivalBottles(updated); setArrivalRows(prev => reapplyAllBottles(updated, prev))
  }

  function handleAsLeftBottleChange(buid: string, newStdId: string) {
    const updated = asLeftBottles.map(b => b.uid === buid ? { ...b, stdId: newStdId } : b)
    setAsLeftBottles(updated); setAsLeftRows(prev => reapplyAllBottles(updated, prev))
  }

  const updateArrivalMeasured = useCallback((id: string, val: string) => {
    setArrivalRows(prev => prev.map(row => {
      if (row.id !== id) return row
      const updated = { ...row, measured: val }
      if (!val) return { ...updated, error: '', result: 'not_installed' as const }
      const { error, result } = calcGasError(updated)
      return { ...updated, error, result }
    }))
  }, [])

  const updateAsLeftMeasured = useCallback((id: string, val: string) => {
    setAsLeftRows(prev => prev.map(row => {
      if (row.id !== id) return row
      const updated = { ...row, measured: val }
      if (!val) return { ...updated, error: '', result: 'not_installed' as const }
      const { error, result } = calcGasError(updated)
      return { ...updated, error, result }
    }))
  }, [])

  function gasOverallResult(): 'pass' | 'fail' | 'na' {
    const asLeftOnly = asLeftRows.filter(r => r.result === 'pass' || r.result === 'fail')
    if (!asLeftOnly.length) return 'na'
    return asLeftOnly.some(r => r.result === 'fail') ? 'fail' : 'pass'
  }

  function toggleFault(description: string) {
    setSelectedFaults(prev => prev.includes(description) ? prev.filter(f => f !== description) : [...prev, description])
  }

  function loadCommTemplate(templateId: string) {
    const tmpl = commTemplates.find(t => t.id === templateId)
    if (tmpl) setChecklist((tmpl.items || []).map((item: any) => ({ ...item, checked: false, notes: '' })))
  }

  async function uploadPhotos(reportId: string): Promise<string[]> {
    const urls: string[] = []
    for (const photo of photos) {
      const path = `${reportId}/${uid()}-${photo.name}`
      const { error } = await supabase.storage.from('reports').upload(path, photo, { upsert: true })
      if (!error) {
        const { data: { publicUrl } } = supabase.storage.from('reports').getPublicUrl(path)
        urls.push(publicUrl)
      }
    }
    return urls
  }

  async function handleSave(saveAsDraft = false) {
    if (!instrumentId) { alert('Please select an instrument.'); return }
    if (isPressureGauge && !pressureRefId) { alert('Please select a reference standard.'); return }
    setSaving(true); setSaveMsg('Saving...')

    const overallResult = isPressureGauge
      ? pressureOverallResult(isNewUnit ? afterAdjRows : [...asReceivedRows, ...afterAdjRows])
      : gasOverallResult()

    const faultText = selectedFaults.length > 0 ? selectedFaults.join('\n') : ''
    const fullFindings = [faultText, findings].filter(Boolean).join('\n')

    const { data: report, error: rErr } = await supabase.from('service_reports').insert({
      instrument_id: instrumentId,
      customer_id: selCustomer?.id ?? selInstrument?.customer_id,
      engineer_id: profile?.id,
      visit_date: visitDate,
      visit_time: visitTime || null,
      site_location: siteLocation || null,
      contact_name: contactName || null,
      firmware_at_visit: firmware || null,
      findings: fullFindings || null,
      work_carried_out: workDone || null,
      recommendations: recommendations || null,
      labour_hours: labourHours ? parseFloat(labourHours) : null,
      overall_result: overallResult,
      customer_printed_name: custPrintName || null,
      sage_number: sageNumber || null,
      fault_codes: selectedFaults,
      visit_type: visitType,
      report_type: isPressureGauge ? 'pressure_cal' : isTemperature ? 'temperature_cal' : 'service',
      commissioning_checklist: checklist.length > 0 ? checklist : null,
      commissioning_notes: commNotes || null,
      cert_expiry_date: certExpiry || null,
      pressure_media: isPressureGauge ? media : null,
      pressure_temperature: isPressureGauge ? parseFloat(tempC) : null,
      pressure_orientation: isPressureGauge ? orientation : null,
      pressure_procedure: isPressureGauge ? procedure : null,
      zeroed_before_cal: isPressureGauge ? zeroedBefore : null,
      status: saveAsDraft ? 'draft' : 'complete',
    }).select().single()

    if (rErr || !report) { alert('Error: ' + rErr?.message); setSaving(false); return }

    if (isTemperature) {
      const tempInserts = tempRows.filter(r => r.setPoint).map((r, i) => ({
        report_id: report.id, instrument_id: instrumentId,
        serial_number: selInstrument?.serial_number,
        sort_order: i, set_point: parseFloat(r.setPoint),
        display_reading: r.displayAsLeft ? parseFloat(r.displayAsLeft) : null,
        display_reading_as_found: r.displayAsFound ? parseFloat(r.displayAsFound) : null,
        sprt_reading: r.sprtReading ? parseFloat(r.sprtReading) : null,
      }))
      if (tempInserts.length) await supabase.from('temperature_readings').insert(tempInserts)
      if (tempRefId) {
        const ref = standards.find((s: any) => s.id === tempRefId)
        if (ref) await supabase.from('report_standards').insert({
          report_id: report.id, standard_id: tempRefId,
          description: ref.description, serial_number: ref.serial_number,
          certificate_no: ref.certificate_no, cal_due_date: ref.cal_due_date
        })
      }
    } else if (isPressureGauge) {
      // Save as received readings
      if (!isNewUnit) {
        const asRecInserts = asReceivedRows.filter(r => r.applied !== '').map((r, i) => ({
          report_id: report.id, instrument_id: instrumentId,
          serial_number: selInstrument?.serial_number,
          sort_order: i, applied_pressure: parseFloat(r.applied),
          reading: r.reading ? parseFloat(r.reading) : null,
          phase: 'as_received',
        }))
        if (asRecInserts.length) await supabase.from('pressure_readings').insert(asRecInserts)
      }

      // Save after adjustment readings
      const afterAdjInserts = afterAdjRows.filter(r => r.applied !== '').map((r, i) => ({
        report_id: report.id, instrument_id: instrumentId,
        serial_number: selInstrument?.serial_number,
        sort_order: i, applied_pressure: parseFloat(r.applied),
        reading: r.reading ? parseFloat(r.reading) : null,
        phase: 'after_adjustment',
      }))
      if (afterAdjInserts.length) await supabase.from('pressure_readings').insert(afterAdjInserts)

      // Save reference standard
      if (pressureRefId) {
        const ref = standards.find((s: any) => s.id === pressureRefId)
        if (ref) await supabase.from('report_standards').insert({
          report_id: report.id, standard_id: pressureRefId,
          description: ref.description, serial_number: ref.serial_number,
          certificate_no: ref.certificate_no, cal_due_date: ref.cal_due_date
        })
      }
    } else if (!isTemperature) {
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
      if (calInserts.length) await supabase.from('calibration_records').insert(calInserts)

      const allStdIds = new Set([
        ...arrivalBottles.filter(b => b.stdId).map(b => b.stdId),
        ...asLeftBottles.filter(b => b.stdId).map(b => b.stdId)
      ])
      const stdInserts = Array.from(allStdIds).map(stdId => {
        const s = standards.find((s: any) => s.id === stdId)
        return s ? { report_id: report.id, standard_id: stdId, description: s.description, serial_number: s.serial_number, certificate_no: s.certificate_no, cal_due_date: s.cal_due_date } : null
      }).filter(Boolean)
      if (stdInserts.length) await supabase.from('report_standards').insert(stdInserts)
    }

    const partInserts = partRows.filter(r => r.description).map(r => ({
      report_id: report.id, description: r.description,
      part_number: r.part_number, quantity: r.quantity, warranty: r.warranty || null
    }))
    if (partInserts.length) await supabase.from('report_parts').insert(partInserts)

    if (photos.length > 0) {
      const urls = await uploadPhotos(report.id)
      if (urls.length > 0) await supabase.from('service_reports').update({ photo_urls: urls }).eq('id', report.id)
    }

    if (!saveAsDraft) {
      await supabase.from('instruments').update({
        last_service_date: visitDate, last_cal_date: visitDate,
        next_cal_date: new Date(new Date(visitDate).setMonth(new Date(visitDate).getMonth() + (selInstrument?.cal_interval_months ?? 12))).toISOString().split('T')[0],
      }).eq('id', instrumentId)
    }

    setSaving(false); setSaveMsg('Saved!')
    router.push(`/dashboard/reports/${report.id}`)
  }

  const faultCategories = [...new Set(faultTypes.map(f => f.category))]
  const checklistCategories = [...new Set(checklist.map((i: any) => i.category))]
  const isCommissioning = visitType === 'commissioning'
  const gasStandards = standards.filter((s: any) => !s.standard_types || s.standard_types.includes('gas'))
  const pressureStandards = standards.filter((s: any) => s.standard_types?.includes('pressure'))
  const tempStandards = standards.filter((s: any) => s.standard_types?.includes('temperature'))
  const dp = selInstrument?.decimal_places || 2
  const tol = selInstrument ? (selInstrument.accuracy_pct_fs * selInstrument.pressure_range / 100).toFixed(dp) : ''
  const afterAdjOverall = pressureOverallResult(afterAdjRows)
  const overall = isPressureGauge ? afterAdjOverall : gasOverallResult()

  const sections = isTemperature
    ? ['Instrument', 'Conditions', 'Reference', 'Readings', 'Notes', 'Sign-off']
    : isPressureGauge
    ? ['Instrument', 'Conditions', 'Reference', isNewUnit ? 'After Calibration' : 'As Received', ...(isNewUnit ? [] : ['After Calibration']), 'Notes', 'Sign-off']
    : isCommissioning
      ? ['Instrument', 'Faults', 'Commissioning', 'On arrival', 'As left', 'Notes', 'Parts', 'Photos', 'Sign-off']
      : ['Instrument', 'Faults', 'On arrival', 'As left', 'Notes', 'Parts', 'Photos', 'Sign-off']

  function PressureTable({ rows, setRows, label, phase }: {
    rows: PressureRow[]
    setRows: React.Dispatch<React.SetStateAction<PressureRow[]>>
    label: string
    phase: 'as_received' | 'after_adjustment'
  }) {
    const overall = pressureOverallResult(rows)
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800">{label}</h3>
          <button onClick={() => {
            const pts = generatePoints()
            if (phase === 'as_received') setAsReceivedRows(pts)
            else setAfterAdjRows(pts.map(r => ({ ...r, id: uid() })))
          }} className="text-xs text-brand-500 hover:underline">↺ Reset points</button>
        </div>

        {tol && (
          <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-2 text-xs text-green-700">
            Tolerance: ±{selInstrument?.accuracy_pct_fs}% FS = ±{tol} {selInstrument?.pressure_unit} · Resolution: {Math.pow(10, -dp).toFixed(dp)} {selInstrument?.pressure_unit}
          </div>
        )}

        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase">
                <th className="px-3 py-2 text-left">Applied ({selInstrument?.pressure_unit})</th>
                <th className="px-3 py-2 text-left">UUT Reading</th>
                <th className="px-3 py-2 text-left">Error</th>
                <th className="px-3 py-2 text-left">Error %FS</th>
                <th className="px-3 py-2 text-left">% of Tol</th>
                <th className="px-3 py-2 text-left">Result</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row, idx) => {
                const calc = calcPressureError(row.applied, row.reading)
                return (
                  <tr key={row.id}>
                    <td className="px-3 py-1.5">
                      <input type="number" step="any" className="w-full border border-gray-200 rounded px-1.5 py-1 text-xs"
                        defaultValue={row.applied}
                        onBlur={e => setRows(prev => prev.map((r, i) => i === idx ? { ...r, applied: autoRound(e.target.value, dp) } : r))} />
                    </td>
                    <td className="px-3 py-1.5">
                      <input type="number" step="any" className="w-full border border-gray-200 rounded px-1.5 py-1 text-xs"
                        defaultValue={row.reading}
                        placeholder={`e.g. ${row.applied}`}
                        onBlur={e => setRows(prev => prev.map((r, i) => i === idx ? { ...r, reading: autoRound(e.target.value, dp) } : r))} />
                    </td>
                    <td className="px-3 py-1.5 font-mono text-gray-600 text-xs">{calc.error || '—'}</td>
                    <td className="px-3 py-1.5 font-mono text-gray-600 text-xs">{calc.errorPct ? calc.errorPct + '%' : '—'}</td>
                    <td className="px-3 py-1.5 font-mono text-gray-600 text-xs">{calc.errorPctTol ? calc.errorPctTol + '%' : '—'}</td>
                    <td className="px-3 py-1.5">
                      {calc.result === 'PASS' ? <span className="px-1.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">PASS</span>
                       : calc.result === 'FAIL' ? <span className="px-1.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">FAIL</span>
                       : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-1.5">
                      <button onClick={() => setRows(prev => prev.filter((_, i) => i !== idx))} className="text-gray-300 hover:text-red-400">x</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <button onClick={() => setRows(prev => [...prev, { id: uid(), applied: '', reading: '' }])} className="text-xs text-brand-500 hover:underline">+ Add row</button>
        {overall !== 'na' && (
          <div className={`rounded-xl px-4 py-2 text-sm font-medium text-center ${overall === 'pass' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {label}: {overall === 'pass' ? 'PASS ✓' : 'FAIL ✗'}
          </div>
        )}
      </div>
    )
  }

  function BottleSelector({ bottles, onBottleChange, onAdd, onRemove, stds }: any) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="label mb-0 font-semibold">Span gas bottle(s) *</label>
          <button onClick={onAdd} className="text-xs text-brand-500 hover:underline">+ Add bottle</button>
        </div>
        {bottles.map((b: any, i: number) => (
          <div key={b.uid} className="flex gap-2 items-start">
            <div className="flex-1">
              <select className={`input ${!b.stdId ? 'border-amber-300 bg-amber-50' : ''}`} value={b.stdId} onChange={e => onBottleChange(b.uid, e.target.value)}>
                <option value="">⚠ Select bottle {i + 1}...</option>
                {stds.map((s: any) => <option key={s.id} value={s.id}>{s.description} (S/N: {s.serial_number})</option>)}
              </select>
              {b.stdId && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {stds.find((s: any) => s.id === b.stdId)?.gas_concentrations?.map((g: any, gi: number) => (
                    <span key={gi} className="badge-info font-mono text-xs">{g.gas}: {g.concentration} {g.unit}</span>
                  ))}
                </div>
              )}
            </div>
            {bottles.length > 1 && <button onClick={() => onRemove(b.uid)} className="text-red-400 text-sm mt-2">x</button>}
          </div>
        ))}
      </div>
    )
  }

  function CalTable({ rows, onUpdate }: { rows: CalRow[]; onUpdate: (id: string, val: string) => void }) {
    return (
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-xs" style={{ minWidth: 500 }}>
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase">
              <th className="px-3 py-2 text-left">Parameter</th>
              <th className="px-3 py-2 text-left">Nominal</th>
              <th className="px-3 py-2 text-left">Tolerance</th>
              <th className="px-3 py-2 text-left">Measured</th>
              <th className="px-3 py-2 text-left">Error</th>
              <th className="px-3 py-2 text-left">Result</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map(row => (
              <tr key={row.id} className={row.result === 'not_installed' ? 'bg-gray-50 opacity-60' : ''}>
                <td className="px-3 py-2 font-medium text-gray-800">{row.parameter}</td>
                <td className="px-3 py-2 font-mono text-blue-600 text-xs">
                  {row.nominal ? `${row.nominal} ${row.unit}` : <span className="text-amber-500 italic">select bottle</span>}
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="p-4 max-w-2xl mx-auto pb-32">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            {isPressureGauge ? 'New calibration certificate' : 'New service report'}
          </h1>
          <p className="text-gray-400 text-xs mt-0.5">Eurotron Instruments (UK) Ltd</p>
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
            {i + 1}. {s}
          </button>
        ))}
      </div>

      {/* SECTION 0: Instrument */}
      {activeSection === 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-gray-800 text-sm">Instrument</h2>
          {!isPressureGauge && !isTemperature && (
            <div>
              <label className="label">Visit type</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: 'service', label: '🔧 Service & Calibration' },
                  { key: 'commissioning', label: '🆕 Commissioning' },
                  { key: 'calibration', label: '📊 Calibration only' },
                  { key: 'repair', label: '🛠 Repair only' },
                ].map(vt => (
                  <button key={vt.key} onClick={() => setVisitType(vt.key as any)}
                    className={`py-2 px-3 rounded-xl border-2 text-xs font-medium text-left transition-colors ${visitType === vt.key ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 bg-white text-gray-500'}`}>
                    {vt.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div>
            <label className="label">Instrument *</label>
            <select className="input" value={instrumentId} onChange={e => {
              const inst = instruments.find(i => i.id === e.target.value)
              if (inst) doSelectInstrument(inst)
            }}>
              <option value="">Select instrument...</option>
              {instruments.map(i => (
                <option key={i.id} value={i.id}>
                  {i.name} - {i.customer?.name}{i.site ? ' / ' + i.site.name : ''} (S/N: {i.serial_number ?? 'N/A'})
                </option>
              ))}
            </select>
          </div>
          {selInstrument && (
            <div className="bg-brand-50 rounded-xl p-3 text-xs space-y-1">
              <div className="flex justify-between"><span className="text-gray-500">Type</span><span className="font-medium">{selInstrument.name}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Make / model</span><span className="font-medium">{selInstrument.make} {selInstrument.model}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Serial number</span><span className="font-mono font-medium">{selInstrument.serial_number}</span></div>
              {isTemperature && (
                <>
                  <div className="flex justify-between"><span className="text-gray-500">Type</span><span className="font-medium">{selInstrument.temp_instrument_type || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Range</span><span className="font-mono font-medium">{selInstrument.temp_range_min} to {selInstrument.temp_range_max} °C</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Accuracy</span><span className="font-mono font-medium">±{selInstrument.temp_accuracy_value} {selInstrument.temp_accuracy_type === 'celsius' ? '°C' : selInstrument.temp_accuracy_type === 'pct_fs' ? '% FS' : '% RDG'}</span></div>
                  {selInstrument.temp_stability && <div className="flex justify-between"><span className="text-gray-500">Stability</span><span className="font-mono font-medium">±{selInstrument.temp_stability} °C</span></div>}
                </>
              )}
              {isPressureGauge && (
                <>
                  <div className="flex justify-between"><span className="text-gray-500">Range</span><span className="font-mono font-medium">{selInstrument.vacuum_range ? selInstrument.vacuum_range + ' to ' : '0 to '}{selInstrument.pressure_range} {selInstrument.pressure_unit}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Accuracy</span><span className="font-mono font-medium">±{selInstrument.accuracy_pct_fs}% FS (±{tol} {selInstrument.pressure_unit})</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Resolution</span><span className="font-mono font-medium">{Math.pow(10, -dp).toFixed(dp)} {selInstrument.pressure_unit}</span></div>
                </>
              )}
            </div>
          )}

          {isPressureGauge && selInstrument && (
            <div>
              <label className="label">Is this a new unit? (first calibration)</label>
              <div className="flex gap-2">
                <button onClick={() => setIsNewUnit(true)}
                  className={`flex-1 py-2 rounded-xl border-2 text-xs font-medium transition-colors ${isNewUnit ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-500'}`}>
                  ✅ Yes — new unit, calibration only
                </button>
                <button onClick={() => setIsNewUnit(false)}
                  className={`flex-1 py-2 rounded-xl border-2 text-xs font-medium transition-colors ${!isNewUnit ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-500'}`}>
                  🔄 No — recalibration (as received + after)
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Visit date</label><input className="input" type="date" value={visitDate} onChange={e => setVisitDate(e.target.value)} /></div>
            <div><label className="label">Visit time</label><input className="input" type="time" value={visitTime} onChange={e => setVisitTime(e.target.value)} /></div>
          </div>
          <div><label className="label">Site / location</label><input className="input" value={siteLocation} onChange={e => setSiteLocation(e.target.value)} /></div>
          <div><label className="label">Contact person</label><input className="input" value={contactName} onChange={e => setContactName(e.target.value)} /></div>
          <div><label className="label">Customer email</label><input className="input" type="email" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} /></div>
          {!isPressureGauge && <div><label className="label">Firmware version</label><input className="input" value={firmware} onChange={e => setFirmware(e.target.value)} /></div>}
          <div><label className="label">Sage sales number</label><input className="input" value={sageNumber} onChange={e => setSageNumber(e.target.value)} /></div>
          {(isPressureGauge || isTemperature) && <div><label className="label">Certificate expiry date</label><input className="input" type="date" value={certExpiry} onChange={e => setCertExpiry(e.target.value)} /></div>}
        </div>
      )}

      {/* TEMPERATURE: Section 1 - Conditions */}
      {isTemperature && activeSection === 1 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-gray-800 text-sm">Test conditions</h2>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Bore size (mm)</label><input className="input" value={tempBoreSize} onChange={e => setTempBoreSize(e.target.value)} placeholder="e.g. 6.35" /></div>
            <div><label className="label">Measurement zone</label><input className="input" value={tempZone} onChange={e => setTempZone(e.target.value)} placeholder="e.g. Bottom" /></div>
          </div>
          <div><label className="label">Stability notes</label><input className="input" value={tempStabilityNote} onChange={e => setTempStabilityNote(e.target.value)} placeholder="e.g. Stability ±0.05°C achieved at each point" /></div>
        </div>
      )}

      {/* PRESSURE: Section 1 - Conditions */}
      {isPressureGauge && activeSection === 1 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-gray-800 text-sm">Test conditions</h2>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Temperature (°C)</label><input className="input" type="number" value={tempC} onChange={e => setTempC(e.target.value)} /></div>
            <div>
              <label className="label">Media</label>
              <select className="input" value={media} onChange={e => setMedia(e.target.value)}>
                {['Air','Oil','Water','Nitrogen','Other'].map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <div><label className="label">Calibration procedure</label><input className="input" value={procedure} onChange={e => setProcedure(e.target.value)} /></div>
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
            <span className="text-sm text-gray-700">Unit was zeroed before calibration</span>
          </label>
        </div>
      )}

      {/* TEMPERATURE: Section 2 - Reference standard */}
      {isTemperature && activeSection === 2 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-gray-800 text-sm">Reference standard (SPRT)</h2>
          {tempStandards.length === 0 ? (
            <div className="bg-amber-50 rounded-xl p-3 text-sm text-amber-700">
              No temperature reference standards found. Go to <a href="/dashboard/admin/standards" className="underline">Admin → Ref Standards</a> and add your SPRT with type set to Temperature.
            </div>
          ) : (
            <>
              <select className={`input ${!tempRefId ? 'border-amber-300 bg-amber-50' : ''}`} value={tempRefId} onChange={e => setTempRefId(e.target.value)}>
                <option value="">⚠ Select SPRT reference...</option>
                {tempStandards.map((s: any) => <option key={s.id} value={s.id}>{s.description} (S/N: {s.serial_number})</option>)}
              </select>
              {tempRefId && (() => {
                const ref = tempStandards.find((s: any) => s.id === tempRefId)
                return ref ? (
                  <div className="bg-brand-50 rounded-xl p-3 text-xs space-y-1">
                    <div className="flex justify-between"><span className="text-gray-500">Description</span><span className="font-medium">{ref.description}</span></div>
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
            </>
          )}
        </div>
      )}

      {/* PRESSURE: Section 2 - Reference standard */}
      {isPressureGauge && activeSection === 2 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-gray-800 text-sm">Reference standard</h2>
          {pressureStandards.length === 0 ? (
            <div className="bg-amber-50 rounded-xl p-3 text-sm text-amber-700">
              No pressure reference standards found. Go to <a href="/dashboard/admin/standards" className="underline">Admin → Ref Standards</a> and add your PACE 5000 with type set to Pressure.
            </div>
          ) : (
            <>
              <select className={`input ${!pressureRefId ? 'border-amber-300 bg-amber-50' : ''}`} value={pressureRefId} onChange={e => setPressureRefId(e.target.value)}>
                <option value="">⚠ Select reference standard...</option>
                {pressureStandards.map((s: any) => <option key={s.id} value={s.id}>{s.description} (S/N: {s.serial_number})</option>)}
              </select>
              {pressureRefId && (() => {
                const ref = pressureStandards.find((s: any) => s.id === pressureRefId)
                return ref ? (
                  <div className="bg-brand-50 rounded-xl p-3 text-xs space-y-1">
                    <div className="flex justify-between"><span className="text-gray-500">Description</span><span className="font-medium">{ref.description}</span></div>
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
            </>
          )}
        </div>
      )}

      {/* TEMPERATURE: Section 3 - Readings */}
      {isTemperature && activeSection === 3 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-800 text-sm">Calibration readings</h2>
              <p className="text-xs text-gray-400 mt-0.5">Set Point → Display Reading → SPRT Reading</p>
            </div>
          </div>

          {selInstrument?.temp_accuracy_value && (
            <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-2 text-xs text-green-700">
              Tolerance: ±{selInstrument.temp_accuracy_value} {selInstrument.temp_accuracy_type === 'celsius' ? '°C' : selInstrument.temp_accuracy_type === 'pct_fs' ? '% FS' : '% RDG'}
              {selInstrument.temp_stability && ` · Stability: ±${selInstrument.temp_stability}°C`}
            </div>
          )}

          {/* New unit toggle */}
          <div className="flex gap-2">
            <button onClick={() => setIsNewTempUnit(true)}
              className={`flex-1 py-2 rounded-xl border-2 text-xs font-medium transition-colors ${isNewTempUnit ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-500'}`}>
              ✅ New unit — calibration only
            </button>
            <button onClick={() => setIsNewTempUnit(false)}
              className={`flex-1 py-2 rounded-xl border-2 text-xs font-medium transition-colors ${!isNewTempUnit ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-500'}`}>
              🔄 Recall — As Found + As Left
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase text-xs">
                  <th className="px-2 py-2 text-left">Set Point</th>
                  <th className="px-2 py-2 text-left">SPRT</th>
                  {!isNewTempUnit && <th className="px-2 py-2 text-left">Disp. Found</th>}
                  {!isNewTempUnit && <th className="px-2 py-2 text-left">Err Found</th>}
                  {!isNewTempUnit && <th className="px-2 py-2 text-left">Res. Found</th>}
                  <th className="px-2 py-2 text-left">{isNewTempUnit ? 'Display' : 'Disp. Left'}</th>
                  <th className="px-2 py-2 text-left">Err {isNewTempUnit ? '' : 'Left'}</th>
                  <th className="px-2 py-2 text-left">Result</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tempRows.map((row, idx) => {
                  const calcFound = calcTempError(row.displayAsFound, row.sprtReading)
                  const calcLeft  = calcTempError(row.displayAsLeft, row.sprtReading)
                  return (
                    <tr key={row.id}>
                      <td className="px-2 py-1.5">
                        <input type="number" step="any" className="w-16 border border-gray-200 rounded px-1.5 py-1 text-xs"
                          defaultValue={row.setPoint}
                          onBlur={e => setTempRows(prev => prev.map((r, i) => i === idx ? { ...r, setPoint: e.target.value } : r))} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="number" step="any" className="w-16 border border-gray-200 rounded px-1.5 py-1 text-xs"
                          defaultValue={row.sprtReading} placeholder="SPRT"
                          onBlur={e => setTempRows(prev => prev.map((r, i) => i === idx ? { ...r, sprtReading: e.target.value } : r))} />
                      </td>
                      {!isNewTempUnit && (
                        <td className="px-2 py-1.5">
                          <input type="number" step="any" className="w-16 border border-gray-200 rounded px-1.5 py-1 text-xs"
                            defaultValue={row.displayAsFound} placeholder="Found"
                            onBlur={e => setTempRows(prev => prev.map((r, i) => i === idx ? { ...r, displayAsFound: e.target.value } : r))} />
                        </td>
                      )}
                      {!isNewTempUnit && <td className="px-2 py-1.5 font-mono text-xs text-gray-500">{calcFound.error || '—'}</td>}
                      {!isNewTempUnit && (
                        <td className="px-2 py-1.5">
                          {calcFound.result === 'PASS' ? <span className="text-xs font-bold text-green-600">P</span>
                           : calcFound.result === 'FAIL' ? <span className="text-xs font-bold text-red-600">F</span>
                           : <span className="text-gray-300">—</span>}
                        </td>
                      )}
                      <td className="px-2 py-1.5">
                        <input type="number" step="any" className="w-16 border border-gray-200 rounded px-1.5 py-1 text-xs"
                          defaultValue={row.displayAsLeft} placeholder="Left"
                          onBlur={e => setTempRows(prev => prev.map((r, i) => i === idx ? { ...r, displayAsLeft: e.target.value } : r))} />
                      </td>
                      <td className="px-2 py-1.5 font-mono text-xs text-gray-500">{calcLeft.error || '—'}</td>
                      <td className="px-2 py-1.5">
                        {calcLeft.result === 'PASS' ? <span className="px-1.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">PASS</span>
                         : calcLeft.result === 'FAIL' ? <span className="px-1.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">FAIL</span>
                         : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-2 py-1.5">
                        <button onClick={() => setTempRows(prev => prev.filter((_, i) => i !== idx))} className="text-gray-300 hover:text-red-400">x</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <button onClick={() => setTempRows(prev => [...prev, { id: uid(), setPoint: '', sprtReading: '', displayAsFound: '', displayAsLeft: '' }])}
            className="text-xs text-brand-500 hover:underline">+ Add row</button>

          {tempOverallResult() !== 'na' && (
            <div className={`rounded-xl px-4 py-3 text-sm font-medium text-center ${tempOverallResult() === 'pass' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {tempOverallResult() === 'pass' ? 'Overall result: PASS ✓' : 'Overall result: FAIL ✗'}
            </div>
          )}
        </div>
      )}

      {/* TEMPERATURE: Section 4 - Notes */}
      {isTemperature && activeSection === 4 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-gray-800 text-sm">Notes</h2>
          <div><label className="label">Notes / observations</label><textarea className="input" rows={4} value={findings} onChange={e => setFindings(e.target.value)} /></div>
          <div className="flex items-center justify-between mt-2">
            <h3 className="text-sm font-semibold text-gray-700">Parts used</h3>
            <button onClick={() => setPartRows(r => [...r, emptyPart()])} className="text-xs text-brand-500 hover:underline">+ Add part</button>
          </div>
          {partRows.map(row => (
            <div key={row.id} className="grid grid-cols-12 gap-1 items-center">
              <input className="col-span-5 border border-gray-200 rounded px-2 py-1.5 text-xs" value={row.description} placeholder="Description" onChange={e => setPartRows(partRows.map(r => r.id !== row.id ? r : { ...r, description: e.target.value }))} />
              <input className="col-span-4 border border-gray-200 rounded px-2 py-1.5 text-xs" value={row.part_number} placeholder="Part no." onChange={e => setPartRows(partRows.map(r => r.id !== row.id ? r : { ...r, part_number: e.target.value }))} />
              <input className="col-span-2 border border-gray-200 rounded px-2 py-1.5 text-xs" type="number" value={row.quantity} onChange={e => setPartRows(partRows.map(r => r.id !== row.id ? r : { ...r, quantity: parseInt(e.target.value) || 1 }))} />
              <button onClick={() => setPartRows(partRows.filter(r => r.id !== row.id))} className="col-span-1 text-gray-300 hover:text-red-400 text-base text-center">x</button>
            </div>
          ))}
        </div>
      )}

      {/* TEMPERATURE: Section 5 - Sign-off */}
      {isTemperature && activeSection === 5 && (
        <div className="space-y-4">
          <h2 className="font-semibold text-gray-800 text-sm">Sign-off</h2>
          <div className="card p-4 space-y-2 text-xs">
            <div className="flex justify-between"><span className="text-gray-500">Instrument</span><span className="font-medium">{selInstrument?.name} {selInstrument?.make} {selInstrument?.model}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Serial number</span><span className="font-mono font-medium">{selInstrument?.serial_number}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Customer</span><span className="font-medium">{selCustomer?.name ?? '—'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Cal date</span><span className="font-medium">{visitDate}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Expiry</span><span className="font-medium">{certExpiry || '—'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Test points</span><span className="font-medium">{tempRows.filter(r => r.setPoint).length}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Result</span>
              <span className={`font-bold ${tempOverallResult() === 'pass' ? 'text-green-600' : tempOverallResult() === 'fail' ? 'text-red-600' : 'text-gray-400'}`}>
                {tempOverallResult() === 'pass' ? 'PASS ✓' : tempOverallResult() === 'fail' ? 'FAIL ✗' : '—'}
              </span>
            </div>
          </div>
          <div><label className="label">Customer printed name</label><input className="input" value={custPrintName} onChange={e => setCustPrintName(e.target.value)} /></div>
          {saveMsg && <div className="text-sm text-brand-600 bg-brand-50 rounded-xl px-4 py-2">{saveMsg}</div>}
          <div className="space-y-2">
            <button onClick={() => handleSave(true)} disabled={saving}
              className="w-full py-3 rounded-xl border-2 border-amber-400 bg-amber-50 text-amber-700 font-semibold text-sm disabled:opacity-50">
              {saving ? 'Saving...' : '💾 Save as draft'}
            </button>
            <button onClick={() => handleSave(false)} disabled={saving}
              className="w-full py-3 rounded-xl bg-brand-500 text-white font-semibold text-sm disabled:opacity-50">
              {saving ? 'Saving...' : '✓ Complete certificate'}
            </button>
          </div>
        </div>
      )}

      {/* PRESSURE: As Received (only if not new unit) */}
      {isPressureGauge && !isNewUnit && activeSection === 3 && (
        <PressureTable rows={asReceivedRows} setRows={setAsReceivedRows} label="As Received (before adjustment)" phase="as_received" />
      )}

      {/* PRESSURE: After Adjustment */}
      {isPressureGauge && activeSection === (isNewUnit ? 3 : 4) && (
        <PressureTable rows={afterAdjRows} setRows={setAfterAdjRows} label="After Adjustment / Calibration" phase="after_adjustment" />
      )}

      {/* PRESSURE: Notes */}
      {isPressureGauge && activeSection === (isNewUnit ? 4 : 5) && (
        <div className="space-y-3">
          <h2 className="font-semibold text-gray-800 text-sm">Notes</h2>
          <div><label className="label">Notes / observations</label><textarea className="input" rows={4} value={findings} onChange={e => setFindings(e.target.value)} /></div>
          <div className="flex items-center justify-between mt-2">
            <h3 className="text-sm font-semibold text-gray-700">Parts used</h3>
            <button onClick={() => setPartRows(r => [...r, emptyPart()])} className="text-xs text-brand-500 hover:underline">+ Add part</button>
          </div>
          {partRows.map(row => (
            <div key={row.id} className="grid grid-cols-12 gap-1 items-center">
              <input className="col-span-5 border border-gray-200 rounded px-2 py-1.5 text-xs" value={row.description} placeholder="Description" onChange={e => setPartRows(partRows.map(r => r.id !== row.id ? r : { ...r, description: e.target.value }))} />
              <input className="col-span-4 border border-gray-200 rounded px-2 py-1.5 text-xs" value={row.part_number} placeholder="Part no." onChange={e => setPartRows(partRows.map(r => r.id !== row.id ? r : { ...r, part_number: e.target.value }))} />
              <input className="col-span-2 border border-gray-200 rounded px-2 py-1.5 text-xs" type="number" value={row.quantity} onChange={e => setPartRows(partRows.map(r => r.id !== row.id ? r : { ...r, quantity: parseInt(e.target.value) || 1 }))} />
              <button onClick={() => setPartRows(partRows.filter(r => r.id !== row.id))} className="col-span-1 text-gray-300 hover:text-red-400 text-base text-center">x</button>
            </div>
          ))}
        </div>
      )}

      {/* PRESSURE: Sign-off */}
      {isPressureGauge && activeSection === (isNewUnit ? 5 : 6) && (
        <div className="space-y-4">
          <h2 className="font-semibold text-gray-800 text-sm">Sign-off</h2>
          <div className="card p-4 space-y-2 text-xs">
            <div className="flex justify-between"><span className="text-gray-500">Instrument</span><span className="font-medium">{selInstrument?.name} {selInstrument?.make} {selInstrument?.model}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Serial number</span><span className="font-mono font-medium">{selInstrument?.serial_number}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Customer</span><span className="font-medium">{selCustomer?.name ?? '—'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Cal date</span><span className="font-medium">{visitDate}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Expiry</span><span className="font-medium">{certExpiry || '—'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Type</span><span className="font-medium">{isNewUnit ? 'New unit — calibration only' : 'Recalibration — as received + after'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Result</span>
              <span className={`font-bold ${overall === 'pass' ? 'text-green-600' : overall === 'fail' ? 'text-red-600' : 'text-gray-400'}`}>
                {overall === 'pass' ? 'PASS ✓' : overall === 'fail' ? 'FAIL ✗' : '—'}
              </span>
            </div>
          </div>
          <div><label className="label">Customer printed name</label><input className="input" value={custPrintName} onChange={e => setCustPrintName(e.target.value)} /></div>
          {saveMsg && <div className="text-sm text-brand-600 bg-brand-50 rounded-xl px-4 py-2">{saveMsg}</div>}
          <div className="space-y-2">
            <button onClick={() => handleSave(true)} disabled={saving}
              className="w-full py-3 rounded-xl border-2 border-amber-400 bg-amber-50 text-amber-700 font-semibold text-sm disabled:opacity-50">
              {saving ? 'Saving...' : '💾 Save as draft'}
            </button>
            <button onClick={() => handleSave(false)} disabled={saving}
              className="w-full py-3 rounded-xl bg-brand-500 text-white font-semibold text-sm disabled:opacity-50">
              {saving ? 'Saving...' : '✓ Complete certificate'}
            </button>
          </div>
        </div>
      )}

      {/* GAS: Section 1 - Faults */}
      {!isPressureGauge && !isTemperature && activeSection === 1 && (
        <div className="space-y-4">
          <h2 className="font-semibold text-gray-800 text-sm">Faults found on arrival</h2>
          {selectedFaults.length > 0 && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-3">
              <p className="text-xs font-semibold text-red-700 mb-1">{selectedFaults.length} fault(s) selected</p>
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
                    <span className={`text-sm ${selectedFaults.includes(fault.description) ? 'text-red-700 font-medium' : 'text-gray-700'}`}>{fault.description}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
          <div><label className="label">Additional findings</label><textarea className="input" rows={3} value={findings} onChange={e => setFindings(e.target.value)} /></div>
        </div>
      )}

      {/* GAS: Commissioning */}
      {!isPressureGauge && !isTemperature && isCommissioning && activeSection === 2 && (
        <div className="space-y-4">
          <h2 className="font-semibold text-gray-800 text-sm">Commissioning checklist</h2>
          {checklist.length === 0 && (
            <div>
              <label className="label">Load template</label>
              <select className="input" onChange={e => loadCommTemplate(e.target.value)}>
                <option value="">Select template...</option>
                {commTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          )}
          {checklist.length > 0 && (
            <>
              <div className="text-xs text-gray-500">{checklist.filter((i: any) => i.checked).length}/{checklist.length} completed</div>
              {checklistCategories.map(cat => (
                <div key={cat} className="card p-4">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{cat}</h3>
                  <div className="space-y-2">
                    {checklist.filter((i: any) => i.category === cat).map((item: any) => (
                      <label key={item.id} className="flex items-start gap-3 cursor-pointer">
                        <input type="checkbox" checked={item.checked}
                          onChange={() => setChecklist(prev => prev.map((i: any) => i.id === item.id ? { ...i, checked: !i.checked } : i))}
                          className="w-4 h-4 rounded mt-0.5" />
                        <span className={`text-sm ${item.checked ? 'text-green-700 line-through' : 'text-gray-700'}`}>{item.item}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              <div><label className="label">Commissioning notes</label><textarea className="input" rows={4} value={commNotes} onChange={e => setCommNotes(e.target.value)} /></div>
            </>
          )}
        </div>
      )}

      {/* GAS: On arrival */}
      {!isPressureGauge && !isTemperature && activeSection === (isCommissioning ? 3 : 2) && (
        <div className="space-y-4">
          <div><h2 className="font-semibold text-gray-800 text-sm">On arrival (as found)</h2><p className="text-xs text-gray-400">Leave blank if not installed.</p></div>
          {arrivalRows.length === 0 ? <div className="bg-amber-50 rounded-xl px-4 py-3 text-sm text-amber-700">Please select an instrument first.</div> : (
            <>
              <BottleSelector bottles={arrivalBottles} onBottleChange={handleArrivalBottleChange}
                onAdd={() => setArrivalBottles(b => [...b, { uid: uid(), stdId: '' }])}
                onRemove={(buid: string) => { const u = arrivalBottles.filter(b => b.uid !== buid); setArrivalBottles(u); setArrivalRows(prev => reapplyAllBottles(u, prev)) }}
                stds={gasStandards} />
              <CalTable rows={arrivalRows} onUpdate={updateArrivalMeasured} />
            </>
          )}
        </div>
      )}

      {/* GAS: As left */}
      {!isPressureGauge && !isTemperature && activeSection === (isCommissioning ? 4 : 3) && (
        <div className="space-y-4">
          <div><h2 className="font-semibold text-gray-800 text-sm">As left (after service)</h2><p className="text-xs text-gray-400">Leave blank if not installed.</p></div>
          {asLeftRows.length === 0 ? <div className="bg-amber-50 rounded-xl px-4 py-3 text-sm text-amber-700">Please select an instrument first.</div> : (
            <>
              <BottleSelector bottles={asLeftBottles} onBottleChange={handleAsLeftBottleChange}
                onAdd={() => setAsLeftBottles(b => [...b, { uid: uid(), stdId: '' }])}
                onRemove={(buid: string) => { const u = asLeftBottles.filter(b => b.uid !== buid); setAsLeftBottles(u); setAsLeftRows(prev => reapplyAllBottles(u, prev)) }}
                stds={gasStandards} />
              <CalTable rows={asLeftRows} onUpdate={updateAsLeftMeasured} />
            </>
          )}
          {asLeftRows.some(r => r.result === 'pass' || r.result === 'fail') && (
            <div className={`rounded-xl px-4 py-3 text-sm font-medium text-center ${overall === 'pass' ? 'bg-green-50 text-green-700' : overall === 'fail' ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-500'}`}>
              {overall === 'pass' ? 'Overall: PASS ✓' : overall === 'fail' ? 'Overall: FAIL ✗' : 'Pending'}
            </div>
          )}
        </div>
      )}

      {/* GAS: Notes */}
      {!isPressureGauge && !isTemperature && activeSection === (isCommissioning ? 5 : 4) && (
        <div className="space-y-3">
          <h2 className="font-semibold text-gray-800 text-sm">Service notes</h2>
          <div><label className="label">Work carried out</label><textarea className="input" rows={4} value={workDone} onChange={e => setWorkDone(e.target.value)} /></div>
          <div><label className="label">Recommendations</label><textarea className="input" rows={3} value={recommendations} onChange={e => setRecommendations(e.target.value)} /></div>
          <div><label className="label">Labour time (hours)</label><input className="input" type="number" step="0.5" value={labourHours} onChange={e => setLabourHours(e.target.value)} style={{ width: 120 }} /></div>
        </div>
      )}

      {/* GAS: Parts */}
      {!isPressureGauge && !isTemperature && activeSection === (isCommissioning ? 6 : 5) && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-800 text-sm">Parts used</h2>
            <button onClick={() => setShowPartPicker(true)} className="btn-secondary text-xs py-1.5">Pick from library</button>
          </div>
          {showPartPicker && (
            <div className="card p-4">
              <div className="flex justify-between mb-3">
                <span className="text-sm font-medium">Parts library</span>
                <button onClick={() => setShowPartPicker(false)} className="text-gray-400">x</button>
              </div>
              <input className="input text-sm mb-3" placeholder="Search..." value={partSearch} onChange={e => setPartSearch(e.target.value)} />
              <div className="space-y-1 max-h-56 overflow-y-auto">
                {partsLib.filter(p => !partSearch || p.description.toLowerCase().includes(partSearch.toLowerCase())).map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between py-1.5 border-b border-gray-50">
                    <div><div className="text-sm">{p.description}</div><div className="text-xs text-gray-400">{p.part_number}</div></div>
                    <button onClick={() => setPartRows(r => [...r, { ...emptyPart(), description: p.description, part_number: p.part_number ?? '' }])} className="text-xs text-brand-500 hover:underline ml-4">+ Add</button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {partRows.map(row => (
            <div key={row.id} className="grid grid-cols-12 gap-1 items-center">
              <input className="col-span-4 border border-gray-200 rounded px-2 py-1.5 text-xs" value={row.description} placeholder="Description" onChange={e => setPartRows(partRows.map(r => r.id !== row.id ? r : { ...r, description: e.target.value }))} />
              <input className="col-span-3 border border-gray-200 rounded px-2 py-1.5 text-xs" value={row.part_number} placeholder="Part no." onChange={e => setPartRows(partRows.map(r => r.id !== row.id ? r : { ...r, part_number: e.target.value }))} />
              <input className="col-span-1 border border-gray-200 rounded px-2 py-1.5 text-xs" type="number" value={row.quantity} onChange={e => setPartRows(partRows.map(r => r.id !== row.id ? r : { ...r, quantity: parseInt(e.target.value) || 1 }))} />
              <select className="col-span-3 border border-gray-200 rounded px-1 py-1.5 text-xs" value={row.warranty} onChange={e => setPartRows(partRows.map(r => r.id !== row.id ? r : { ...r, warranty: e.target.value }))}>
                <option value="">Warranty?</option><option value="yes">Yes</option><option value="no">No</option><option value="na">N/A</option>
              </select>
              <button onClick={() => setPartRows(partRows.filter(r => r.id !== row.id))} className="col-span-1 text-gray-300 hover:text-red-400 text-base text-center">x</button>
            </div>
          ))}
          <button onClick={() => setPartRows(r => [...r, emptyPart()])} className="text-xs text-brand-500 hover:underline">+ Add part</button>
        </div>
      )}

      {/* GAS: Photos */}
      {!isPressureGauge && !isTemperature && activeSection === (isCommissioning ? 7 : 6) && (
        <div className="space-y-4">
          <div><h2 className="font-semibold text-gray-800 text-sm">Photos</h2><p className="text-xs text-gray-400">Up to 5 photos.</p></div>
          <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center">
            <input type="file" accept="image/*" multiple capture="environment" className="hidden" id="photo-upload"
              onChange={e => {
                const files = Array.from(e.target.files || []).slice(0, 5)
                setPhotos(files); setPhotoUrls(files.map(f => URL.createObjectURL(f)))
              }} />
            <label htmlFor="photo-upload" className="cursor-pointer">
              <div className="text-3xl mb-2">📷</div>
              <div className="text-sm text-gray-600 font-medium">Tap to take or select photos</div>
            </label>
          </div>
          {photoUrls.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {photoUrls.map((url, i) => (
                <div key={i} className="relative">
                  <img src={url} alt="" className="w-full h-24 object-cover rounded-lg" />
                  <button onClick={() => { setPhotos(p => p.filter((_, idx) => idx !== i)); setPhotoUrls(u => u.filter((_, idx) => idx !== i)) }}
                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">x</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* GAS: Sign-off */}
      {!isPressureGauge && !isTemperature && activeSection === (isCommissioning ? 8 : 7) && (
        <div className="space-y-4">
          <h2 className="font-semibold text-gray-800 text-sm">Sign-off & send</h2>
          <div className="card p-4 space-y-2 text-xs">
            <div className="flex justify-between"><span className="text-gray-500">Instrument</span><span className="font-medium">{selInstrument?.name ?? '—'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Customer</span><span className="font-medium">{selCustomer?.name ?? '—'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Date</span><span className="font-medium">{visitDate}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Result</span>
              <span className={`font-bold ${overall === 'pass' ? 'text-green-600' : overall === 'fail' ? 'text-red-600' : 'text-gray-400'}`}>
                {overall === 'pass' ? 'PASS ✓' : overall === 'fail' ? 'FAIL ✗' : '—'}
              </span>
            </div>
          </div>
          <div><label className="label">Customer printed name</label><input className="input" value={custPrintName} onChange={e => setCustPrintName(e.target.value)} /></div>
          {saveMsg && <div className="text-sm text-brand-600 bg-brand-50 rounded-xl px-4 py-2">{saveMsg}</div>}
          <div className="space-y-2">
            <button onClick={() => handleSave(true)} disabled={saving}
              className="w-full py-3 rounded-xl border-2 border-amber-400 bg-amber-50 text-amber-700 font-semibold text-sm disabled:opacity-50">
              {saving ? 'Saving...' : '💾 Save as draft'}
            </button>
            {customerEmail && (
              <button onClick={() => handleSave(false)} disabled={saving}
                className="w-full py-3 rounded-xl bg-brand-500 text-white font-semibold text-sm disabled:opacity-50">
                {saving ? 'Saving...' : '✉ Save & email'}
              </button>
            )}
            <button onClick={() => handleSave(false)} disabled={saving}
              className="w-full py-3 rounded-xl border border-gray-200 bg-white text-gray-700 font-medium text-sm disabled:opacity-50">
              {saving ? 'Saving...' : '✓ Save & complete'}
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
