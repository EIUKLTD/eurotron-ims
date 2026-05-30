
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

const TRACEABILITY_STATEMENT =
  'This certificate is produced by using test gases which are produced in accordance to ISO 6141. ' +
  'The certified results shown below are traceable to gas reference material or to mass traceable to national standard.'

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
  instrument: {
    name: string
    make: string | null
    model: string | null
    serial_number: string | null
    asset_tag: string | null
    analyser_type: string | null
    gases_measured: string[] | null
    next_cal_date: string | null
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
  report_parts: ReportPart[]
  report_standards: ReportStandard[]
}

export function generateReportPDF(report: ReportData): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W   = 210
  const M   = 14
  const TW  = W - M * 2
  let y     = 0

  function newPage() {
    doc.addPage()
    y = 14
  }

  function chk(need: number) { if (y + need > 272) newPage() }

  function setFont(style: 'normal'|'bold', size: number, color: [number,number,number] = C.text) {
    doc.setFont('helvetica', style)
    doc.setFontSize(size)
    doc.setTextColor(...color)
  }

  function sectionHeader(title: string) {
    chk(12); y += 4
    doc.setFillColor(...C.darkGray)
    doc.rect(M, y, TW, 7, 'F')
    setFont('bold', 8, C.green)
    doc.text(title.toUpperCase(), M + 3, y + 4.8)
    y += 10
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
    if (result === 'pass') {
      doc.setFillColor(...C.pass)
      doc.roundedRect(x, cy - 3, 14, 5, 1, 1, 'F')
      setFont('bold', 7, C.white)
      doc.text('PASS', x + 7, cy + 0.5, { align: 'center' })
    } else if (result === 'fail') {
      doc.setFillColor(...C.fail)
      doc.roundedRect(x, cy - 3, 14, 5, 1, 1, 'F')
      setFont('bold', 7, C.white)
      doc.text('FAIL', x + 7, cy + 0.5, { align: 'center' })
    } else {
      setFont('normal', 8, C.muted)
      doc.text('—', x + 7, cy + 0.5, { align: 'center' })
    }
  }

  function testMethodBox(testMethod: string) {
    chk(12)
    doc.setFillColor(235, 243, 255)
    doc.rect(M, y, TW, 9, 'F')
    doc.setDrawColor(180, 210, 240)
    doc.setLineWidth(0.3)
    doc.rect(M, y, TW, 9, 'S')
    setFont('bold', 7.5, [26, 107, 181])
    doc.text('Test method:', M + 2, y + 4)
    setFont('normal', 7.5, [40, 60, 100])
    const lines = doc.splitTextToSize(testMethod, TW - 32)
    doc.text(lines, M + 30, y + 4)
    y += 12
  }

  function traceabilityBox() {
    chk(16)
    doc.setFillColor(252, 252, 240)
    doc.rect(M, y, TW, 14, 'F')
    doc.setDrawColor(200, 190, 120)
    doc.setLineWidth(0.4)
    doc.rect(M, y, TW, 14, 'S')
    setFont('bold', 7.5, [100, 90, 20])
    doc.text('Traceability statement:', M + 2, y + 4.5)
    setFont('normal', 7.5, [60, 55, 10])
    const lines = doc.splitTextToSize(TRACEABILITY_STATEMENT, TW - 4)
    doc.text(lines, M + 2, y + 9)
    y += 17
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
    doc.text('Reference standards used:', M + 2, y + 4.5)
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

  function calTable(rows: CalRecord[], title: string) {
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
    heads.forEach((h, i) => {
      setFont('bold', 7.5, C.muted)
      doc.text(h, cx + 1, y + 4)
      cx += cols[i]
    })
    y += 7

    rows.forEach(row => {
      cx = M
      const vals = [row.parameter, row.nominal??'', row.tolerance??'', row.measured??'', row.error_value??'']
      vals.forEach((v, i) => {
        setFont('normal', 8.5, C.text)
        doc.text(v || '—', cx + 1, y + 4, { maxWidth: cols[i] - 2 })
        cx += cols[i]
      })
      resultBadge(row.result, cx + 1, y + 4)
      y += 7
    })
    y += 4
  }

  // ── HEADER ───────────────────────────────────────────────────
  doc.setFillColor(...C.black)
  doc.rect(0, 0, W, 36, 'F')

  // Green accent line
  doc.setFillColor(...C.green)
  doc.rect(0, 34, W, 2, 'F')

  // EiUK Logo box
  // EiUK Logo box
  doc.setFillColor(20, 20, 20)
  doc.setDrawColor(...C.green)
  doc.setLineWidth(2)
  doc.roundedRect(10, 5, 32, 24, 4, 4, 'FD')
  setFont('bold', 15, C.green)
  doc.text('EiUK', 26, 19, { align: 'center' })

  // Company name
  setFont('bold', 13, C.white)
  doc.text('Eurotron Instruments (UK) Ltd', 44, 13)
  setFont('normal', 8.5, C.green)
  doc.text('Gas Analyser Calibration Certificate', 44, 21)
  setFont('normal', 7, [180, 180, 180])
  doc.text('Instrument Service & Calibration', 44, 28)

  // Certificate number box
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
    W - 30, 26, { align: 'center' }
  )

  y = 42

  // ── CUSTOMER & SITE ──────────────────────────────────────────
  sectionHeader('Customer & site')
  fieldPair('Customer', report.customer?.name ?? '', 'Site / location', (report.site_location ?? '').replace(/`/g, ''))
  fieldPair('Contact on site', report.contact_name ?? '', 'Customer phone', report.customer?.contact_phone ?? '')
  fieldPair(
    'Visit date',
    report.visit_date ? new Date(report.visit_date).toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'}) : '',
    'Visit time', report.visit_time ?? ''
  )
  fieldPair('Engineer', report.engineer?.full_name ?? report.engineer?.email ?? '', 'Engineer email', report.engineer?.email ?? '')
  if ((report as any).sage_number) {
    fieldPair('Sage sales number', (report as any).sage_number, '', '')
  }

  // ── EQUIPMENT UNDER TEST ─────────────────────────────────────
  sectionHeader('Equipment under test')
  fieldPair('Instrument', report.instrument?.name ?? '', 'Analyser type', report.instrument?.analyser_type ?? '')
  fieldPair('Make', report.instrument?.make ?? '', 'Model', report.instrument?.model ?? '')
  fieldPair('Serial number', report.instrument?.serial_number ?? '', 'Asset / tag ID', report.instrument?.asset_tag ?? '')
  fieldPair('Firmware at visit', report.firmware_at_visit ?? '', 'Next cal due', report.instrument?.next_cal_date ?? '')
  if (report.instrument?.gases_measured?.length) {
    fieldFull('Gases measured', report.instrument.gases_measured.join(', '))
  }

  // ── CALIBRATION RESULTS ──────────────────────────────────────
  sectionHeader('Calibration results')

  const testMethod = (report as any).test_method ||
    'Comparison against certified reference gas standards produced in accordance with ISO 6141'

  const arrival = (report.calibration_records ?? [])
    .filter(r => r.phase === 'arrival')
    .sort((a,b) => a.sort_order - b.sort_order)
  const asLeft  = (report.calibration_records ?? [])
    .filter(r => r.phase === 'as_left')
    .sort((a,b) => a.sort_order - b.sort_order)

  testMethodBox(testMethod)
  traceabilityBox()
  referenceStandardsBox(report.report_standards)
  calTable(arrival, 'On arrival (as found)')
  calTable(asLeft, 'As left (after service)')

  // ── SERVICE NOTES ─────────────────────────────────────────────
  if (report.findings || report.work_carried_out || report.recommendations || report.labour_hours) {
    sectionHeader('Service notes')
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
      chk(8)
      setFont('normal', 9, C.text)
      doc.text(`Labour time: ${report.labour_hours} hr(s)`, M, y); y += 7
    }
  }

  // ── PARTS USED ────────────────────────────────────────────────
  if (report.report_parts?.length) {
    sectionHeader('Parts used')
    const pCols = [TW*0.40, TW*0.22, TW*0.12, TW*0.26]
    const pHeads = ['Description','Part number','Qty','Warranty']
    doc.setFillColor(235, 238, 243)
    doc.rect(M, y, TW, 6, 'F')
    let cx = M
    pHeads.forEach((h, i) => {
      setFont('bold', 7.5, C.muted)
      doc.text(h, cx + 1, y + 4)
      cx += pCols[i]
    })
    y += 7
    report.report_parts.forEach(p => {
      chk(7); cx = M
      const vals = [p.description, p.part_number??'—', String(p.quantity)]
      vals.forEach((v, i) => {
        setFont('normal', 8.5, C.text)
        doc.text(v, cx + 1, y + 4, { maxWidth: pCols[i]-2 }); cx += pCols[i]
      })
      const wc = p.warranty === 'yes' ? C.pass : p.warranty === 'no' ? C.fail : C.muted
      doc.setFillColor(...wc)
      doc.roundedRect(cx + 1, y + 1, 22, 4.5, 1, 1, 'F')
      setFont('bold', 7, C.white)
      doc.text(
        p.warranty === 'yes' ? 'Warranty' : p.warranty === 'no' ? 'No warranty' : '—',
        cx + 12, y + 4.2, { align: 'center' }
      )
      y += 7
    })
    y += 2
  }

  // ── SIGN-OFF ──────────────────────────────────────────────────
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
  doc.text(report.engineer?.full_name ?? report.engineer?.email ?? '', M + 2, y + 17)
  doc.text(report.customer_printed_name ?? '', M + bw + 10, y + 17)
  y += 28
  setFont('normal', 8, C.text)
  doc.text(
    `Date: ${report.visit_date ? new Date(report.visit_date).toLocaleDateString('en-GB') : ''}`,
    M, y
  )

  // ── FOOTER ON ALL PAGES ───────────────────────────────────────
  const totalPages = (doc as any).internal.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFillColor(...C.darkGray)
    doc.rect(0, 282, W, 15, 'F')
    doc.setFillColor(...C.green)
    doc.rect(0, 282, W, 1, 'F')
    setFont('normal', 6, C.green)
    doc.text(COMPANY_ADDRESS, W / 2, 288, { align: 'center' })
    setFont('normal', 6, [150, 150, 150])
    doc.text('Gas Analyser Calibration Certificate', M, 293)
    doc.text(`Page ${i} of ${totalPages}  |  ${report.report_number}`, W - M, 293, { align: 'right' })
  }

  return doc
}
