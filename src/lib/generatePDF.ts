import jsPDF from 'jspdf'

const C = {
  black:    [0,   0,   0]   as [number,number,number],
  green:    [126, 216, 87]  as [number,number,number],
  pass:     [15,  110, 70]  as [number,number,number],
  fail:     [180, 50,  25]  as [number,number,number],
  lightBg:  [245, 247, 250] as [number,number,number],
  border:   [220, 224, 230] as [number,number,number],
  text:     [30,  30,  30]  as [number,number,number],
  muted:    [120, 120, 120] as [number,number,number],
  white:    [255, 255, 255] as [number,number,number],
  darkGray: [40,  40,  40]  as [number,number,number],
}

const GAS_TRACEABILITY =
  'This certificate is produced by using test gases which are produced in accordance to ISO 6141. ' +
  'The certified results shown below are traceable to gas reference material or to mass traceable to national standard.'

const PRESSURE_TRACEABILITY =
  'All measuring equipment used for calibration purposes is traceable to National or Internationally recognised standards.'


const EIUK_LOGO_BASE64 = 'data:image/png;base64,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'

const COMPANY_ADDRESS = 'Eurotron Instruments UK Ltd  |  Unit 18 Austin Way, Royal Oak Industrial Estate, Daventry, Northamptonshire NN11 8QY  |  Tel: 01327 871044  |  www.ei-uk.com'

interface CalRecord {
  parameter: string
  nominal: string | null
  tolerance: string | null
  measured: string | null
  error_value: string | null
  result: string | null
  phase: string
  sort_order: number
}

interface PressureReading {
  applied_pressure: number
  reading: number | null
  phase: string
  sort_order: number
}

interface ReportPart {
  description: string
  part_number: string | null
  quantity: number
  warranty: string | null
}

interface ReportStandard {
  description: string | null
  make: string | null
  model: string | null
  serial_number: string | null
  certificate_no: string | null
  cal_due_date: string | null
}

export interface ReportData {
  report_number: string
  visit_date: string
  visit_time: string | null
  site_location: string | null
  contact_name: string | null
  firmware_at_visit: string | null
  findings: string | null
  work_carried_out: string | null
  recommendations: string | null
  labour_hours: number | null
  overall_result: string | null
  customer_printed_name: string | null
  sent_at: string | null
  test_method?: string | null
  sage_number?: string | null
  report_type?: string | null
  cert_expiry_date?: string | null
  pressure_media?: string | null
  pressure_temperature?: number | null
  pressure_orientation?: string | null
  pressure_procedure?: string | null
  zeroed_before_cal?: boolean | null
  instrument: {
    name: string
    make: string | null
    model: string | null
    serial_number: string | null
    asset_tag: string | null
    analyser_type: string | null
    gases_measured: string[] | null
    next_cal_date: string | null
    instrument_category?: string | null
    pressure_range?: number | null
    pressure_unit?: string | null
    accuracy_pct_fs?: number | null
    decimal_places?: number | null
    gauge_type?: string | null
    pressure_connection?: string | null
    vacuum_range?: number | null
  } | null
  customer: {
    name: string
    address: string | null
    city: string | null
    postcode: string | null
    contact_name: string | null
    contact_email: string | null
    contact_phone: string | null
  } | null
  engineer: {
    full_name: string
    email: string
  } | null
  calibration_records: CalRecord[]
  pressure_readings?: PressureReading[]
  report_parts: ReportPart[]
  report_standards: ReportStandard[]
}

export function generateReportPDF(report: ReportData): jsPDF {
  const isPressure = report.report_type === 'pressure_cal' ||
    report.instrument?.instrument_category === 'pressure_gauge'
  const isTemperature = report.report_type === 'temperature_cal' ||
    report.instrument?.instrument_category === 'temperature'
  const isCalCert = isPressure || isTemperature

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W   = 210
  const M   = 14
  const TW  = W - M * 2
  let y     = 0

  function newPage() { doc.addPage(); y = isCalCert ? 42 : 14 }
  function chk(need: number) { if (y + need > 272) newPage() }

  function setFont(style: 'normal'|'bold', size: number, color: [number,number,number] = C.text) {
    doc.setFont('helvetica', style)
    doc.setFontSize(size)
    doc.setTextColor(...color)
  }

  function sectionHeader(title: string) {
    chk(12); y += 4
    if (isCalCert) {
      // Light style for pressure - dark text with green underline
      setFont('bold', 10, C.darkGray)
      doc.text(title.toUpperCase(), M, y + 5)
      doc.setDrawColor(...C.green)
      doc.setLineWidth(1)
      doc.line(M, y + 8, M + TW, y + 8)
    } else {
      doc.setFillColor(...C.darkGray)
      doc.rect(M, y, TW, 7, 'F')
      setFont('bold', 8, C.green)
      doc.text(title.toUpperCase(), M + 3, y + 4.8)
    }
    y += 11
  }

  function fieldPair(l1: string, v1: string, l2: string, v2: string) {
    chk(10)
    const hw = TW / 2 - 3
    setFont('normal', 7.5, C.muted)
    doc.text(l1, M, y)
    doc.text(l2, M + TW / 2, y)
    setFont('normal', 9.5, C.text)
    doc.text(v1 || '—', M, y + 5, { maxWidth: hw })
    doc.text(v2 || '—', M + TW / 2, y + 5, { maxWidth: hw })
    y += 13
  }

  function fieldFull(label: string, value: string) {
    chk(12)
    setFont('normal', 7.5, C.muted)
    doc.text(label, M, y)
    setFont('normal', 9.5, C.text)
    const lines = doc.splitTextToSize(value || '—', TW)
    doc.text(lines, M, y + 5)
    y += 6 + lines.length * 5
  }

  function resultBadge(result: string | null, x: number, cy: number) {
    if (result === 'pass' || result === 'PASS') {
      if (isCalCert) {
        setFont('bold', 7.5, C.pass)
        doc.text('PASS', x + 7, cy + 0.5, { align: 'center' })
      } else {
        doc.setFillColor(...C.pass)
        doc.roundedRect(x, cy - 3, 14, 5, 1, 1, 'F')
        setFont('bold', 7, C.white)
        doc.text('PASS', x + 7, cy + 0.5, { align: 'center' })
      }
    } else if (result === 'fail' || result === 'FAIL') {
      if (isCalCert) {
        setFont('bold', 7.5, C.fail)
        doc.text('FAIL', x + 7, cy + 0.5, { align: 'center' })
      } else {
        doc.setFillColor(...C.fail)
        doc.roundedRect(x, cy - 3, 14, 5, 1, 1, 'F')
        setFont('bold', 7, C.white)
        doc.text('FAIL', x + 7, cy + 0.5, { align: 'center' })
      }
    } else {
      setFont('normal', 8, C.muted)
      doc.text('—', x + 7, cy + 0.5, { align: 'center' })
    }
  }

  function infoBox(color: [number,number,number], borderColor: [number,number,number], labelColor: [number,number,number], textColor: [number,number,number], label: string, text: string) {
    chk(16)
    const lines = doc.splitTextToSize(text, TW - 4)
    const boxH = 8 + lines.length * 4.5
    doc.setFillColor(...color)
    doc.rect(M, y, TW, boxH, 'F')
    doc.setDrawColor(...borderColor)
    doc.setLineWidth(0.4)
    doc.rect(M, y, TW, boxH, 'S')
    // Use dark gray for labels when printing pressure certs
    setFont('bold', 8, isPressure ? C.darkGray : labelColor)
    doc.text(label, M + 2, y + 4.5)
    setFont('normal', 7.5, C.text)
    doc.text(lines, M + 2, y + 9)
    y += boxH + 3
  }

  function referenceStandardsBox(standards: ReportStandard[]) {
    if (!standards?.length) return
    chk(20)
    const lineH = 9.5
    const boxH = 8 + standards.length * lineH
    doc.setFillColor(240, 245, 255)
    doc.setDrawColor(...C.border)
    doc.setLineWidth(0.3)
    doc.rect(M, y, TW, boxH, 'F')
    doc.rect(M, y, TW, boxH, 'S')
    setFont('bold', 8, [26, 107, 181])
    doc.text('Reference standard(s) used:', M + 2, y + 4.5)
    let ty = y + 9
    standards.forEach((s, i) => {
      setFont('bold', 7.5, C.text)
      doc.text(`Standard ${i + 1}: ${s.description ?? ''}`, M + 2, ty)
      setFont('normal', 7.5, C.muted)
      const detail = [
        s.serial_number ? `S/N: ${s.serial_number}` : '',
        s.certificate_no ? `Cert no: ${s.certificate_no}` : '',
        s.cal_due_date ? `Cal due: ${s.cal_due_date}` : '',
      ].filter(Boolean).join('   |   ')
      doc.text(detail, M + 55, ty)
      ty += lineH
    })
    y += boxH + 4
  }

  function gasCalTable(rows: CalRecord[], title: string) {
    if (!rows.length) return
    const rowH = 7
    const totalNeeded = 8 + 7 + rows.length * rowH + 6
    if (y + totalNeeded > 272) newPage()
    setFont('bold', 9, C.text)
    doc.text(title, M, y); y += 5
    const cols = [TW*0.22, TW*0.14, TW*0.15, TW*0.14, TW*0.17, TW*0.18]
    const heads = ['Parameter','Nominal','Tolerance','Measured','Error','Result']
    doc.setFillColor(235, 238, 243)
    doc.rect(M, y, TW, 6, 'F')
    let cx = M
    heads.forEach((h, i) => { setFont('bold', 7.5, C.muted); doc.text(h, cx + 1, y + 4); cx += cols[i] })
    y += 7
    rows.forEach(row => {
      cx = M
      const vals = [row.parameter, row.nominal??'', row.tolerance??'', row.measured??'', row.error_value??'']
      vals.forEach((v, i) => { setFont('normal', 8.5, C.text); doc.text(v || '—', cx + 1, y + 4, { maxWidth: cols[i] - 2 }); cx += cols[i] })
      resultBadge(row.result, cx + 1, y + 4)
      y += 7
    })
    y += 4
  }

  function pressureCalTable(rows: PressureReading[], title: string) {
    if (!rows.length) return
    const inst = report.instrument
    const dp = inst?.decimal_places || 2
    const range = inst?.pressure_range || 1
    const acc = inst?.accuracy_pct_fs || 0.05
    const tol = acc * range / 100
    const unit = inst?.pressure_unit || 'bar'

    const rowH = 6.5
    const totalNeeded = 8 + 8 + rows.length * rowH + 6
    if (y + totalNeeded > 272) newPage()

    setFont('bold', 9, C.text)
    doc.text(title, M, y); y += 5

    const cols = [TW*0.16, TW*0.16, TW*0.16, TW*0.16, TW*0.16, TW*0.20]
    const heads = [`Applied (${unit})`, `UUT Reading (${unit})`, `Error (${unit})`, 'Error %FS', '% of Tol', 'Result']

    doc.setFillColor(235, 238, 243)
    doc.rect(M, y, TW, 8, 'F')
    let cx = M
    heads.forEach((h, i) => {
      setFont('bold', 6.5, C.muted)
      const hlines = h.split(' ')
      if (hlines.length > 2) {
        doc.text(hlines.slice(0,2).join(' '), cx + 1, y + 3.5)
        doc.text(hlines.slice(2).join(' '), cx + 1, y + 7)
      } else {
        doc.text(h, cx + 1, y + 5)
      }
      cx += cols[i]
    })
    y += 9

    rows.forEach(row => {
      if (row.reading === null || row.reading === undefined) {
        cx = M
        setFont('normal', 8, C.text)
        doc.text(row.applied_pressure.toFixed(dp), cx + 1, y + 4); cx += cols[0]
        setFont('normal', 8, C.muted)
        doc.text('—', cx + 1, y + 4); cx += cols[1]
        doc.text('—', cx + 1, y + 4); cx += cols[2]
        doc.text('—', cx + 1, y + 4); cx += cols[3]
        doc.text('—', cx + 1, y + 4); cx += cols[4]
        setFont('normal', 8, C.muted); doc.text('—', cx + 1, y + 4)
        y += rowH; return
      }
      const err = row.reading - row.applied_pressure
      const errPct = (err / range) * 100
      const errPctTol = tol > 0 ? (Math.abs(err) / tol) * 100 : 0
      const result = Math.abs(err) <= tol ? 'PASS' : 'FAIL'
      cx = M
      const vals = [
        row.applied_pressure.toFixed(dp),
        row.reading.toFixed(dp),
        (err >= 0 ? '+' : '') + err.toFixed(dp + 2),
        (errPct >= 0 ? '+' : '') + errPct.toFixed(4) + '%',
        Math.round(errPctTol) + '%',
      ]
      vals.forEach((v, i) => {
        setFont('normal', 8, C.text)
        doc.text(v, cx + 1, y + 4)
        cx += cols[i]
      })
      resultBadge(result, cx + 1, y + 4)
      y += rowH
    })
    y += 4
  }

  // ── HEADER ─────────────────────────────────────────────────────
  if (isCalCert) {
    // Light header for pressure/temperature - white background with green border
    doc.setFillColor(255, 255, 255)
    doc.rect(0, 0, W, 38, 'F')
    doc.setFillColor(...C.green)
    doc.rect(0, 36, W, 2, 'F')
    doc.setDrawColor(...C.green)
    doc.setLineWidth(0.5)
    doc.rect(0, 0, W, 38, 'S')

    // EiUK Logo - actual PNG image
    doc.addImage(EIUK_LOGO_BASE64, 'PNG', 10, 10, 40, 17.6)

    setFont('bold', 14, C.darkGray)
    doc.text('Eurotron Instruments (UK) Ltd', 55, 13)
    setFont('bold', 14, C.darkGray)
    doc.text('CERTIFICATE OF CALIBRATION', 55, 25)
  } else if (!isTemperature) {
    doc.setFillColor(...C.black)
    doc.rect(0, 0, W, 36, 'F')
    doc.setFillColor(...C.green)
    doc.rect(0, 34, W, 2, 'F')

    // EiUK Logo - actual PNG image (inverted colours on dark background)
    doc.addImage(EIUK_LOGO_BASE64, 'PNG', 10, 10, 40, 17.6)

    setFont('bold', 13, C.white)
    doc.text('Eurotron Instruments (UK) Ltd', 48, 13)
    setFont('normal', 8.5, C.green)
    doc.text('Gas Analyser Calibration Certificate', 48, 21)
    setFont('normal', 7, [180, 180, 180])
    doc.text('Instrument Calibration Services', 48, 28)
  }

  // Certificate number box
  if (isCalCert) {
    doc.setFillColor(248, 248, 248)
    doc.rect(W - 58, 4, 48, 28, 'F')
    doc.setDrawColor(...C.green)
    doc.setLineWidth(0.8)
    doc.rect(W - 58, 4, 48, 28, 'S')
    setFont('normal', 6.5, C.green)
    doc.text('CERTIFICATE NUMBER', W - 34, 11, { align: 'center' })
    setFont('bold', 10, C.darkGray)
    doc.text(report.report_number, W - 34, 19, { align: 'center' })
    setFont('normal', 7, C.muted)
    doc.text(
      report.visit_date ? new Date(report.visit_date).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : '',
      W - 34, 27, { align: 'center' }
    )
  } else {
    doc.setFillColor(...C.darkGray)
    doc.rect(W - 56, 4, 52, 28, 'F')
    doc.setDrawColor(...C.green)
    doc.setLineWidth(0.8)
    doc.rect(W - 56, 4, 52, 28, 'S')
    setFont('normal', 6.5, C.green)
    doc.text('CERTIFICATE NUMBER', W - 30, 11, { align: 'center' })
    setFont('bold', 10, C.white)
    doc.text(report.report_number, W - 30, 19, { align: 'center' })
    setFont('normal', 7, [180, 180, 180])
    doc.text(
      report.visit_date ? new Date(report.visit_date).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : '',
      W - 30, 27, { align: 'center' }
    )
  }

  y = isCalCert ? 46 : 42

  // ── CUSTOMER & SITE ────────────────────────────────────────────
  sectionHeader('Customer & site')
  fieldPair('Customer', report.customer?.name ?? '', 'Site / location', report.site_location ?? '')
  if (!isPressure && !isTemperature) {
    fieldPair('Contact on site', report.contact_name ?? '', 'Customer phone', report.customer?.contact_phone ?? '')
  }
  fieldPair(
    isCalCert ? 'Date' : 'Visit date',
    report.visit_date ? new Date(report.visit_date).toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'}) : '',
    isCalCert ? '' : 'Visit time',
    isCalCert ? '' : (report.visit_time ?? '')
  )
  if (!isPressure && !isTemperature) {
    fieldPair('Engineer', report.engineer?.full_name ?? '', 'Engineer email', report.engineer?.email ?? '')
  }
  if (report.sage_number) fieldPair('Sage sales number', report.sage_number, '', '')

  // ── EQUIPMENT UNDER TEST ───────────────────────────────────────
  sectionHeader('Unit under test')
  const inst = report.instrument
  fieldPair('Instrument type', inst?.name ?? '', isPressure ? 'Gauge type' : isTemperature ? 'Instrument type' : 'Analyser type', isPressure ? (inst?.gauge_type ?? '') : isTemperature ? (inst?.temp_instrument_type ?? '') : (inst?.analyser_type ?? ''))
  fieldPair('Manufacturer', inst?.make ?? '', 'Model', inst?.model ?? '')
  fieldPair('Serial number', inst?.serial_number ?? '', 'Asset / tag ID', inst?.asset_tag ?? '')

  if (isPressure && !isTemperature) {
    const range = inst?.pressure_range
    const vac = inst?.vacuum_range
    const unit = inst?.pressure_unit || 'bar'
    const dp = inst?.decimal_places || 2
    const tol = inst?.accuracy_pct_fs && range ? (inst.accuracy_pct_fs * range / 100).toFixed(dp) : '—'
    fieldPair(
      'Pressure range',
      range ? `${vac ? vac + ' to ' : '0 to '}${range} ${unit}` : '—',
      'Accuracy',
      inst?.accuracy_pct_fs ? `±${inst.accuracy_pct_fs}% FS (±${tol} ${unit})` : '—'
    )
    fieldPair(
      'Connection',
      inst?.pressure_connection ?? '—',
      'Resolution',
      dp ? `${Math.pow(10, -dp).toFixed(dp)} ${unit}` : '—'
    )
    if (report.cert_expiry_date) {
      fieldPair(
        'Calibration date',
        report.visit_date ? new Date(report.visit_date).toLocaleDateString('en-GB') : '—',
        'Certificate expiry (advisory)',
        new Date(report.cert_expiry_date).toLocaleDateString('en-GB')
      )
    }
  } else if (isTemperature) {
    const accType = inst?.temp_accuracy_type
    const accVal = inst?.temp_accuracy_value
    const accLabel = accType === 'celsius' ? '°C' : accType === 'pct_fs' ? '% FS' : '% RDG'
    fieldPair('Range', inst?.temp_range_min != null ? `${inst.temp_range_min} to ${inst.temp_range_max} °C` : '—', 'Accuracy', accVal ? `±${accVal} ${accLabel}` : '—')
    fieldPair('Stability', inst?.temp_stability ? `±${inst.temp_stability} °C` : '—', 'Resolution', inst?.temp_display_resolution ? `${inst.temp_display_resolution} °C` : '—')
    if (report.cert_expiry_date) {
      fieldPair('Calibration date', report.visit_date ? new Date(report.visit_date).toLocaleDateString('en-GB') : '—', 'Certificate expiry (advisory)', new Date(report.cert_expiry_date).toLocaleDateString('en-GB'))
    }
  } else {
    fieldPair('Firmware at visit', report.firmware_at_visit ?? '', 'Next cal due', inst?.next_cal_date ?? '')
    if (inst?.gases_measured?.length) fieldFull('Gases measured', inst.gases_measured.join(', '))
  }

  // ── PRESSURE: TEST CONDITIONS ──────────────────────────────────
  if (isPressure) {
    sectionHeader('Test conditions')
    fieldPair('Temperature', `${report.pressure_temperature ?? 23}°C`, 'Pressure media', report.pressure_media ?? 'Air')
    fieldPair('Procedure', report.pressure_procedure ?? '—', 'Orientation', report.pressure_orientation ?? '—')
    fieldPair('Zeroed before calibration', report.zeroed_before_cal ? 'Yes' : 'No', 'Basis of tolerance', 'Manufacturer Specification')
  }

  // ── CALIBRATION RESULTS ────────────────────────────────────────
  chk(60)
  sectionHeader('Calibration results')

  if (isTemperature) {
    // Temperature traceability
    infoBox(
      [252, 252, 240], [200, 190, 120], C.darkGray, C.text,
      'Traceability statement:',
      'All measuring equipment used for calibration purposes is traceable to National or Internationally recognised standards.'
    )
    infoBox(
      [235, 243, 255], [180, 210, 240], C.darkGray, C.text,
      'Test method:',
      `The Calibration/Verification has been carried out by comparing the readings on the display of the Temperature Calibrator to the ones of a Calibrated SPRT with Temperature Indicator. Measurements were taken on the 6.35 mm bore, measurement zone Bottom.`
    )
    referenceStandardsBox(report.report_standards)

    // Temperature readings table
    const tempReadings = (report as any).temperature_readings || []
    if (tempReadings.length > 0) {
      const hasAsFound = tempReadings.some((r: any) => r.display_reading_as_found !== null)
      const rowH = 6.5
      const totalNeeded = 8 + 8 + tempReadings.length * rowH + 6
      if (y + totalNeeded > 272) newPage()
      setFont('bold', 9, C.text)
      doc.text(hasAsFound ? 'Calibration Results' : 'Calibration Results', M, y); y += 5
      const cols = hasAsFound
        ? [TW*0.10, TW*0.10, TW*0.12, TW*0.12, TW*0.10, TW*0.12, TW*0.12, TW*0.12, TW*0.10]
        : [TW*0.15, TW*0.15, TW*0.18, TW*0.18, TW*0.15, TW*0.19]
      const heads = hasAsFound
        ? ['Set Point', 'SPRT', 'Disp. Found', 'Err Found', 'Res.', 'Disp. Left', 'Err Left', 'Result', '']
        : ['Set Point (°C)', 'SPRT (°C)', 'Display (°C)', 'Error (°C)', 'Result', '']
      doc.setFillColor(235, 238, 243)
      doc.rect(M, y, TW, 8, 'F')
      let cx = M
      heads.forEach((h, i) => {
        setFont('bold', 6.5, C.muted)
        doc.text(h, cx + 1, y + 5)
        cx += cols[i]
      })
      y += 9
      tempReadings.forEach((row: any) => {
        const sprt = row.sprt_reading
        const dispLeft = row.display_reading
        const dispFound = row.display_reading_as_found
        const errLeft = sprt !== null && dispLeft !== null ? dispLeft - sprt : null
        const errFound = sprt !== null && dispFound !== null ? dispFound - sprt : null
        const acc = inst?.temp_accuracy_value || 0.5
        const tolLeft = Math.abs(errLeft || 0) <= acc
        const tolFound = Math.abs(errFound || 0) <= acc
        cx = M
        if (hasAsFound) {
          const vals = [
            row.set_point?.toFixed(1) || '—',
            sprt?.toFixed(4) || '—',
            dispFound?.toFixed(1) || '—',
            errFound !== null ? (errFound >= 0 ? '+' : '') + errFound.toFixed(4) : '—',
            dispFound !== null ? (tolFound ? 'P' : 'F') : '—',
            dispLeft?.toFixed(1) || '—',
            errLeft !== null ? (errLeft >= 0 ? '+' : '') + errLeft.toFixed(4) : '—',
          ]
          vals.forEach((v, i) => { setFont('normal', 7.5, C.text); doc.text(v, cx + 1, y + 4); cx += cols[i] })
          if (dispLeft !== null) {
            setFont('bold', 7.5, tolLeft ? C.pass : C.fail)
            doc.text(tolLeft ? 'PASS' : 'FAIL', cx + 1, y + 4)
          }
        } else {
          const vals = [
            row.set_point?.toFixed(1) || '—',
            sprt?.toFixed(4) || '—',
            dispLeft?.toFixed(1) || '—',
            errLeft !== null ? (errLeft >= 0 ? '+' : '') + errLeft.toFixed(4) : '—',
          ]
          vals.forEach((v, i) => { setFont('normal', 7.5, C.text); doc.text(v, cx + 1, y + 4); cx += cols[i] })
          if (dispLeft !== null) {
            setFont('bold', 7.5, tolLeft ? C.pass : C.fail)
            doc.text(tolLeft ? 'PASS' : 'FAIL', cx + 1, y + 4)
          }
        }
        y += rowH
      })
      y += 4
    }

  } else if (isPressure) {
    // Pressure traceability
    infoBox(
      [252, 252, 240], [200, 190, 120], [100, 90, 20], [60, 55, 10],
      'Traceability statement:',
      PRESSURE_TRACEABILITY
    )

    // Test method
    infoBox(
      [235, 243, 255], [180, 210, 240], [26, 107, 181], [40, 60, 100],
      'Test method:',
      'Comparison against a calibrated reference pressure standard traceable to national or international measurement standards'
    )

    referenceStandardsBox(report.report_standards)

    const pressureReadings = report.pressure_readings || []
    const asReceived = pressureReadings.filter(r => r.phase === 'as_received').sort((a, b) => a.sort_order - b.sort_order)
    const afterAdj   = pressureReadings.filter(r => r.phase === 'after_adjustment').sort((a, b) => a.sort_order - b.sort_order)

    if (asReceived.length > 0) pressureCalTable(asReceived, 'As Received Results')
    if (afterAdj.length > 0)   pressureCalTable(afterAdj, asReceived.length > 0 ? 'After Adjustment Results' : 'Calibration Results')

    // Tolerance info box
    if (inst?.accuracy_pct_fs && inst?.pressure_range) {
      const dp = inst.decimal_places || 2
      const tol = (inst.accuracy_pct_fs * inst.pressure_range / 100).toFixed(dp)
      chk(10)
      doc.setFillColor(245, 247, 250)
      doc.rect(M, y, TW, 8, 'F')
      setFont('normal', 7.5, C.muted)
      doc.text(`Permissible deviation: ±${inst.accuracy_pct_fs}% FS = ±${tol} ${inst.pressure_unit || 'bar'}`, M + 2, y + 5)
      y += 11
    }

  } else if (!isTemperature) {
    // Gas traceability
    infoBox(
      [252, 252, 240], [200, 190, 120], [100, 90, 20], [60, 55, 10],
      'Traceability statement:',
      GAS_TRACEABILITY
    )

    const testMethod = report.test_method ||
      'Comparison against certified reference gas standards produced in accordance with ISO 6141'
    infoBox(
      [235, 243, 255], [180, 210, 240], [26, 107, 181], [40, 60, 100],
      'Test method:', testMethod
    )

    referenceStandardsBox(report.report_standards)

    const arrival = (report.calibration_records ?? [])
      .filter(r => r.phase === 'arrival').sort((a,b) => a.sort_order - b.sort_order)
    const asLeft  = (report.calibration_records ?? [])
      .filter(r => r.phase === 'as_left').sort((a,b) => a.sort_order - b.sort_order)

    gasCalTable(arrival, 'On arrival (as found)')
    gasCalTable(asLeft, 'As left (after service)')
  }

  // ── OVERALL RESULT ─────────────────────────────────────────────
  if (report.overall_result === 'pass' || report.overall_result === 'fail') {
    chk(12)
    const isPass = report.overall_result === 'pass'
    if (!isPressure) {
      doc.setFillColor(...(isPass ? [230, 248, 240] : [253, 235, 232]) as [number,number,number])
      doc.roundedRect(M, y, TW, 9, 2, 2, 'F')
      doc.setDrawColor(...(isPass ? C.pass : C.fail))
      doc.setLineWidth(0.5)
      doc.roundedRect(M, y, TW, 9, 2, 2, 'S')
    }
    setFont('bold', 10, isPass ? C.pass : C.fail)
    doc.text(isPass ? 'Overall result: PASS' : 'Overall result: FAIL', W/2, y + 6, { align: 'center' })
    y += 13
  }

  // ── SERVICE NOTES ──────────────────────────────────────────────
  if (report.findings || report.work_carried_out || report.recommendations || report.labour_hours) {
    sectionHeader(isPressure ? 'Notes' : 'Service notes')
    if (report.findings) {
      chk(14)
      setFont('bold', 8, C.muted); doc.text('Findings / observations', M, y); y += 4
      setFont('normal', 9, C.text)
      const lines = doc.splitTextToSize(report.findings, TW)
      doc.text(lines, M, y); y += lines.length * 5 + 4
    }
    if (report.work_carried_out) {
      chk(14)
      setFont('bold', 8, C.muted); doc.text('Work carried out', M, y); y += 4
      setFont('normal', 9, C.text)
      const lines = doc.splitTextToSize(report.work_carried_out, TW)
      doc.text(lines, M, y); y += lines.length * 5 + 4
    }
    if (report.recommendations) {
      chk(14)
      setFont('bold', 8, C.muted); doc.text('Recommendations', M, y); y += 4
      setFont('normal', 9, C.text)
      const lines = doc.splitTextToSize(report.recommendations, TW)
      doc.text(lines, M, y); y += lines.length * 5 + 4
    }
    if (report.labour_hours) {
      chk(8); setFont('normal', 9, C.text)
      doc.text(`Labour time: ${report.labour_hours} hr(s)`, M, y); y += 7
    }
  }

  // ── PARTS USED ─────────────────────────────────────────────────
  if (report.report_parts?.length) {
    sectionHeader('Parts used')
    const pCols = [TW*0.40, TW*0.22, TW*0.12, TW*0.26]
    const pHeads = ['Description','Part number','Qty','Warranty']
    doc.setFillColor(235, 238, 243)
    doc.rect(M, y, TW, 6, 'F')
    let cx = M
    pHeads.forEach((h, i) => { setFont('bold', 7.5, C.muted); doc.text(h, cx + 1, y + 4); cx += pCols[i] })
    y += 7
    report.report_parts.forEach(p => {
      chk(7); cx = M
      const vals = [p.description, p.part_number??'—', String(p.quantity)]
      vals.forEach((v, i) => { setFont('normal', 8.5, C.text); doc.text(v, cx + 1, y + 4, { maxWidth: pCols[i]-2 }); cx += pCols[i] })
      const wc = p.warranty === 'yes' ? C.pass : p.warranty === 'no' ? C.fail : C.muted
      doc.setFillColor(...wc)
      doc.roundedRect(cx + 1, y + 1, 22, 4.5, 1, 1, 'F')
      setFont('bold', 7, C.white)
      doc.text(p.warranty === 'yes' ? 'Warranty' : p.warranty === 'no' ? 'No warranty' : '—', cx + 12, y + 4.2, { align: 'center' })
      y += 7
    })
    y += 2
  }

  // ── SIGN-OFF ───────────────────────────────────────────────────
  if (!isPressure && !isTemperature) {
    chk(50)
    sectionHeader('Sign-off')
    const bw = TW / 2 - 4
    doc.setDrawColor(...C.border)
    doc.setLineWidth(0.4)
    doc.roundedRect(M, y, bw, 22, 2, 2, 'S')
    doc.roundedRect(M + bw + 8, y, bw, 22, 2, 2, 'S')
    setFont('normal', 7.5, C.muted)
    doc.text('Engineer signature', M + 2, y + 4)
    doc.text('Customer signature', M + bw + 10, y + 4)
    setFont('normal', 8.5, C.text)
    doc.text(report.engineer?.full_name ?? '', M + 2, y + 17)
    doc.text(report.customer_printed_name ?? '', M + bw + 10, y + 17)
    y += 28
    setFont('normal', 8, C.text)
    doc.text(`Date: ${report.visit_date ? new Date(report.visit_date).toLocaleDateString('en-GB') : ''}`, M, y)
  } else {
    chk(12)
    setFont('normal', 8, C.muted)
    doc.text(`Calibrated by: ${report.engineer?.full_name ?? ''}`, M, y)
    doc.text(`Date: ${report.visit_date ? new Date(report.visit_date).toLocaleDateString('en-GB') : ''}`, M + 80, y)
    y += 6
  }

  // ── FOOTER ON ALL PAGES ────────────────────────────────────────
  const totalPages = (doc as any).internal.getNumberOfPages()
  const certTitle = isCalCert ? 'Certificate of Calibration' : 'Gas Analyser Calibration Certificate'
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    if (isCalCert && i > 1) {
      // Repeat header on subsequent pages
      doc.setFillColor(255, 255, 255)
      doc.rect(0, 0, W, 30, 'F')
      doc.setFillColor(...C.green)
      doc.rect(0, 28, W, 1.5, 'F')
      doc.addImage(EIUK_LOGO_BASE64, 'PNG', 8, 3, 28, 12.3)
      doc.setFillColor(248, 248, 248)
      doc.rect(W - 55, 3, 45, 22, 'F')
      doc.setDrawColor(...C.green)
      doc.setLineWidth(0.5)
      doc.rect(W - 55, 3, 45, 22, 'S')
      setFont('normal', 6, C.green)
      doc.text('CERTIFICATE NUMBER', W - 32, 9, { align: 'center' })
      setFont('bold', 9, C.darkGray)
      doc.text(report.report_number, W - 32, 17, { align: 'center' })
      setFont('bold', 11, C.darkGray)
      doc.text('Eurotron Instruments (UK) Ltd', 44, 10)
      setFont('bold', 9, C.darkGray)
      doc.text('CERTIFICATE OF CALIBRATION', 44, 20)
    }
    if (isCalCert) {
      // Light footer for pressure - no black fill
      doc.setDrawColor(...C.border)
      doc.setLineWidth(0.5)
      doc.line(M, 281, W - M, 281)
      setFont('normal', 6, C.muted)
      doc.text(COMPANY_ADDRESS, W / 2, 286, { align: 'center' })
      setFont('normal', 6, [180, 180, 180])
      doc.text(certTitle, M, 291)
      doc.text(`Page ${i} of ${totalPages}  |  ${report.report_number}`, W - M, 291, { align: 'right' })
    } else {
      doc.setFillColor(...C.darkGray)
      doc.rect(0, 282, W, 15, 'F')
      doc.setFillColor(...C.green)
      doc.rect(0, 282, W, 1, 'F')
      setFont('normal', 6, C.green)
      doc.text(COMPANY_ADDRESS, W / 2, 288, { align: 'center' })
      setFont('normal', 6, [150, 150, 150])
      doc.text(certTitle, M, 293)
      doc.text(`Page ${i} of ${totalPages}  |  ${report.report_number}`, W - M, 293, { align: 'right' })
    }
  }

  return doc
}
