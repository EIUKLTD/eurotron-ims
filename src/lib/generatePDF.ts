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

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W   = 210
  const M   = 14
  const TW  = W - M * 2
  let y     = 0

  function newPage() { doc.addPage(); y = 14 }
  function chk(need: number) { if (y + need > 272) newPage() }

  function setFont(style: 'normal'|'bold', size: number, color: [number,number,number] = C.text) {
    doc.setFont('helvetica', style)
    doc.setFontSize(size)
    doc.setTextColor(...color)
  }

  function sectionHeader(title: string) {
    chk(12); y += 4
    if (isPressure) {
      // Light style for pressure - no fill, just green text with underline
      setFont('bold', 9, C.green)
      doc.text(title.toUpperCase(), M, y + 5)
      doc.setDrawColor(...C.green)
      doc.setLineWidth(0.5)
      doc.line(M, y + 7, M + TW, y + 7)
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
      if (isPressure) {
        setFont('bold', 7.5, C.pass)
        doc.text('PASS', x + 7, cy + 0.5, { align: 'center' })
      } else {
        doc.setFillColor(...C.pass)
        doc.roundedRect(x, cy - 3, 14, 5, 1, 1, 'F')
        setFont('bold', 7, C.white)
        doc.text('PASS', x + 7, cy + 0.5, { align: 'center' })
      }
    } else if (result === 'fail' || result === 'FAIL') {
      if (isPressure) {
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
    setFont('bold', 7.5, labelColor)
    doc.text(label, M + 2, y + 4.5)
    setFont('normal', 7.5, textColor)
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
  if (isPressure) {
    // Light header for pressure - white background with green border
    doc.setFillColor(255, 255, 255)
    doc.rect(0, 0, W, 38, 'F')
    doc.setFillColor(...C.green)
    doc.rect(0, 36, W, 2, 'F')
    doc.setDrawColor(...C.green)
    doc.setLineWidth(0.5)
    doc.rect(0, 0, W, 38, 'S')

    // EiUK Logo - dark box
    doc.setFillColor(20, 20, 20)
    doc.setDrawColor(...C.green)
    doc.setLineWidth(0.8)
    doc.roundedRect(10, 5, 32, 26, 4, 4, 'FD')
    setFont('bold', 20, C.green)
    doc.text('EiUK', 26, 22, { align: 'center' })

    setFont('bold', 15, C.darkGray)
    doc.text('Eurotron Instruments (UK) Ltd', 48, 14)
    setFont('bold', 13, C.green)
    doc.text('Calibration Certificate', 48, 26)
  } else {
    doc.setFillColor(...C.black)
    doc.rect(0, 0, W, 36, 'F')
    doc.setFillColor(...C.green)
    doc.rect(0, 34, W, 2, 'F')

    // EiUK Logo
    doc.setFillColor(20, 20, 20)
    doc.setDrawColor(...C.green)
    doc.setLineWidth(0.8)
    doc.roundedRect(10, 5, 32, 24, 4, 4, 'FD')
    setFont('bold', 20, C.green)
    doc.text('EiUK', 26, 21, { align: 'center' })

    setFont('bold', 13, C.white)
    doc.text('Eurotron Instruments (UK) Ltd', 48, 13)
    setFont('normal', 8.5, C.green)
    doc.text('Gas Analyser Calibration Certificate', 48, 21)
    setFont('normal', 7, [180, 180, 180])
    doc.text('Instrument Calibration Services', 48, 28)
  }

  // Certificate number box
  if (isPressure) {
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

  y = 42

  // ── CUSTOMER & SITE ────────────────────────────────────────────
  sectionHeader('Customer & site')
  fieldPair('Customer', report.customer?.name ?? '', 'Site / location', report.site_location ?? '')
  if (!isPressure) {
    fieldPair('Contact on site', report.contact_name ?? '', 'Customer phone', report.customer?.contact_phone ?? '')
  }
  fieldPair(
    isPressure ? 'Date' : 'Visit date',
    report.visit_date ? new Date(report.visit_date).toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'}) : '',
    isPressure ? '' : 'Visit time',
    isPressure ? '' : (report.visit_time ?? '')
  )
  if (!isPressure) {
    fieldPair('Engineer', report.engineer?.full_name ?? '', 'Engineer email', report.engineer?.email ?? '')
  }
  if (report.sage_number) fieldPair('Sage sales number', report.sage_number, '', '')

  // ── EQUIPMENT UNDER TEST ───────────────────────────────────────
  sectionHeader('Unit under test')
  const inst = report.instrument
  fieldPair('Instrument type', inst?.name ?? '', isPressure ? 'Gauge type' : 'Analyser type', isPressure ? (inst?.gauge_type ?? '') : (inst?.analyser_type ?? ''))
  fieldPair('Manufacturer', inst?.make ?? '', 'Model', inst?.model ?? '')
  fieldPair('Serial number', inst?.serial_number ?? '', 'Asset / tag ID', inst?.asset_tag ?? '')

  if (isPressure) {
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
  sectionHeader('Calibration results')

  if (isPressure) {
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

  } else {
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
  if (!isPressure) {
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
  const certTitle = isPressure ? 'Calibration Certificate' : 'Gas Analyser Calibration Certificate'
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    if (isPressure) {
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
