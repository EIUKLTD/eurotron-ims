'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import Link from 'next/link'
import jsPDF from 'jspdf'

const COMPANY_ADDRESS = 'Eurotron Instruments UK Ltd  |  Unit 18 Austin Way, Royal Oak Industrial Estate, Daventry, Northamptonshire NN11 8QY  |  Tel: 01327 871044  |  www.ei-uk.com'

export default function PressureCertDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [cert, setCert]         = useState<any>(null)
  const [readings, setReadings] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [toast, setToast]       = useState('')
  const supabase = createClient()

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  useEffect(() => {
    Promise.all([
      supabase.from('pressure_certificates').select('*, customer:customers(name), engineer:profiles(full_name,email)').eq('id', id).single(),
      supabase.from('pressure_cal_readings').select('*').eq('cert_id', id).order('sort_order'),
    ]).then(([{ data: c }, { data: r }]) => {
      setCert(c); setReadings(r||[]); setLoading(false)
    })
  }, [id])

  function calcError(applied: number, reading: number | null) {
    if (reading === null || reading === undefined) return { error: null, errorPct: null, result: null }
    const err = reading - applied
    const range = cert?.pressure_range || 1
    const errPct = (err / range) * 100
    const tol = (cert?.accuracy_pct_fs || 0.05) * range / 100
    return {
      error: parseFloat(err.toFixed(6)),
      errorPct: parseFloat(errPct.toFixed(6)),
      result: Math.abs(err) <= tol ? 'PASS' : 'FAIL'
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this certificate? This cannot be undone.')) return
    await supabase.from('pressure_cal_readings').delete().eq('cert_id', id)
    await supabase.from('pressure_certificates').delete().eq('id', id)
    router.push('/dashboard/pressure')
  }

  function generatePDF() {
    if (!cert) return
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const W = 210, M = 14, TW = W - M * 2
    let y = 0

    function sf(style: 'normal'|'bold', size: number, r=30, g=30, b=30) {
      doc.setFont('helvetica', style); doc.setFontSize(size); doc.setTextColor(r,g,b)
    }

    // Header - black background
    doc.setFillColor(0,0,0)
    doc.rect(0, 0, W, 36, 'F')
    doc.setFillColor(126,216,87)
    doc.rect(0, 34, W, 2, 'F')

    // EiUK logo
    doc.setFillColor(20,20,20)
    doc.setDrawColor(126,216,87)
    doc.setLineWidth(0.8)
    doc.roundedRect(10, 5, 32, 24, 4, 4, 'FD')
    sf('bold', 20, 126, 216, 87)
    doc.text('EiUK', 26, 21, { align: 'center' })

    sf('bold', 13, 255, 255, 255)
    doc.text('Eurotron Instruments (UK) Ltd', 48, 12)
    sf('normal', 8.5, 126, 216, 87)
    doc.text('Pressure Gauge Calibration Certificate', 48, 20)
    sf('normal', 7, 180, 180, 180)
    doc.text('Instrument Calibration Services', 48, 27)

    // Cert number box
    doc.setFillColor(40,40,40)
    doc.rect(W-56, 4, 52, 28, 'F')
    doc.setDrawColor(126,216,87)
    doc.setLineWidth(0.8)
    doc.rect(W-56, 4, 52, 28, 'S')
    sf('normal', 6.5, 126, 216, 87)
    doc.text('CERTIFICATE NUMBER', W-30, 11, { align: 'center' })
    sf('bold', 10, 255, 255, 255)
    doc.text(cert.cert_number, W-30, 19, { align: 'center' })
    sf('normal', 7, 180, 180, 180)
    doc.text(cert.calibration_date ? format(parseISO(cert.calibration_date),'dd MMM yyyy') : '', W-30, 27, { align: 'center' })

    y = 42

    // Page header text
    sf('bold', 11, 30, 30, 30)
    doc.text(`CALIBRATION CERTIFICATE ${cert.cert_number}`, W/2, y, { align: 'center' })
    y += 5
    sf('normal', 8, 100, 100, 100)
    doc.text('Page 1 of 1', W/2, y, { align: 'center' })
    y += 8

    // Two column header - UUT and Reference Standard
    const col1 = M, col2 = M + TW/2 + 4, cw = TW/2 - 4

    sf('bold', 8, 40, 40, 40)
    doc.setFillColor(40,40,40)
    doc.rect(col1, y, cw, 6, 'F')
    doc.rect(col2, y, cw, 6, 'F')
    sf('bold', 7.5, 126, 216, 87)
    doc.text('UNIT UNDER TEST (UUT)', col1+2, y+4)
    doc.text('REFERENCE STANDARD', col2+2, y+4)
    y += 8

    function labelVal(x: number, label: string, val: string, yPos: number) {
      sf('normal', 7, 120, 120, 120)
      doc.text(label, x, yPos)
      sf('normal', 8, 30, 30, 30)
      doc.text(val||'—', x+28, yPos)
    }

    const rows = [
      ['Manufacturer', cert.manufacturer||'—', 'Model', cert.ref_model||'—'],
      ['Model', `${cert.model||'—'}`, 'Serial Number', cert.ref_serial||'—'],
      ['Serial Number', cert.serial_number||'—', 'Range', cert.ref_range||'—'],
      ['Accuracy', `${cert.accuracy_pct_fs}% FS`, 'UKAS Certificate', cert.ref_ukas_cert||'—'],
      ['Pressure Range', `${cert.pressure_range} ${cert.pressure_unit}`, '', ''],
      ['Vacuum Range', cert.vacuum_range ? `${cert.vacuum_range} ${cert.pressure_unit}` : '—', '', ''],
      ['Type', cert.gauge_type||'—', '', ''],
      ['Connection', cert.pressure_connection||'—', '', ''],
      ['Cal Date', cert.calibration_date ? format(parseISO(cert.calibration_date),'dd/MM/yyyy') : '—', '', ''],
    ]

    rows.forEach(([l1,v1,l2,v2]) => {
      labelVal(col1, l1, v1, y)
      if (l2) labelVal(col2, l2, v2, y)
      y += 5.5
    })
    y += 4

    // Conditions bar
    doc.setFillColor(245,247,250)
    doc.rect(M, y, TW, 8, 'F')
    doc.setDrawColor(220,224,230)
    doc.setLineWidth(0.3)
    doc.rect(M, y, TW, 8, 'S')
    sf('normal', 7.5, 60, 60, 60)
    doc.text(`Temperature: ${cert.temperature_c}°C`, M+3, y+5)
    doc.text(`Procedure: ${cert.calibration_procedure}`, M+45, y+5)
    doc.text(`Media: ${cert.media}`, M+100, y+5)
    y += 12

    // Calibration table header
    doc.setFillColor(40,40,40)
    doc.rect(M, y, TW, 7, 'F')
    sf('bold', 7.5, 126, 216, 87)
    doc.text('CALIBRATION RESULTS', M+3, y+4.8)
    y += 9

    // Tolerance info
    const tol = (cert.accuracy_pct_fs * cert.pressure_range / 100).toFixed(4)
    doc.setFillColor(235,243,255)
    doc.rect(M, y, TW, 7, 'F')
    doc.setDrawColor(180,210,240)
    doc.setLineWidth(0.3)
    doc.rect(M, y, TW, 7, 'S')
    sf('normal', 7.5, 40, 60, 100)
    doc.text(`Permissible deviation: ±${cert.accuracy_pct_fs}% FS = ±${tol} ${cert.pressure_unit}  |  Full Scale: ${cert.pressure_range} ${cert.pressure_unit}`, M+3, y+4.5)
    y += 10

    // Table columns
    const cols = [TW*0.12, TW*0.13, TW*0.12, TW*0.10, TW*0.13, TW*0.12, TW*0.10, TW*0.10, TW*0.08]
    const heads = [`Applied\n(${cert.pressure_unit})`, `Reading\nUp`, `Error\nUp (${cert.pressure_unit})`, `Error\nUp %FS`, `Reading\nDown`, `Error\nDown (${cert.pressure_unit})`, `Error\nDown %FS`, `Perm.\n%FS`, 'Result']

    doc.setFillColor(235,238,243)
    doc.rect(M, y, TW, 9, 'F')
    let cx = M
    heads.forEach((h, i) => {
      sf('bold', 6.5, 100, 100, 100)
      const lines = h.split('\n')
      doc.text(lines[0], cx+1, y+3.5)
      if (lines[1]) doc.text(lines[1], cx+1, y+7)
      cx += cols[i]
    })
    y += 10

    readings.forEach(row => {
      const up = calcError(row.applied_pressure, row.reading_up)
      const dn = calcError(row.applied_pressure, row.reading_down)
      const rowResult = !up.result && !dn.result ? null :
        up.result === 'FAIL' || dn.result === 'FAIL' ? 'FAIL' : 'PASS'

      cx = M
      const vals = [
        row.applied_pressure?.toString(),
        row.reading_up !== null ? row.reading_up?.toString() : '—',
        up.error !== null ? up.error?.toString() : '—',
        up.errorPct !== null ? up.errorPct?.toString() : '—',
        row.reading_down !== null ? row.reading_down?.toString() : '—',
        dn.error !== null ? dn.error?.toString() : '—',
        dn.errorPct !== null ? dn.errorPct?.toString() : '—',
        `±${cert.accuracy_pct_fs}`,
      ]
      vals.forEach((v, i) => {
        sf('normal', 7.5, 30, 30, 30)
        doc.text(v||'—', cx+1, y+4)
        cx += cols[i]
      })
      // Result badge
      if (rowResult === 'PASS') {
        doc.setFillColor(15,110,70)
        doc.roundedRect(cx+1, y+1, 14, 5, 1, 1, 'F')
        sf('bold', 6.5, 255, 255, 255)
        doc.text('PASS', cx+8, y+4.5, { align: 'center' })
      } else if (rowResult === 'FAIL') {
        doc.setFillColor(180,50,25)
        doc.roundedRect(cx+1, y+1, 14, 5, 1, 1, 'F')
        sf('bold', 6.5, 255, 255, 255)
        doc.text('FAIL', cx+8, y+4.5, { align: 'center' })
      } else {
        sf('normal', 7.5, 180, 180, 180)
        doc.text('—', cx+8, y+4, { align: 'center' })
      }
      y += 7
    })
    y += 4

    // Overall result
    const ovr = cert.overall_result
    if (ovr === 'pass' || ovr === 'fail') {
      doc.setFillColor(...(ovr === 'pass' ? [230,248,240] as [number,number,number] : [253,235,232] as [number,number,number]))
      doc.roundedRect(M, y, TW, 8, 2, 2, 'F')
      doc.setDrawColor(...(ovr === 'pass' ? [15,110,70] as [number,number,number] : [180,50,25] as [number,number,number]))
      doc.setLineWidth(0.5)
      doc.roundedRect(M, y, TW, 8, 2, 2, 'S')
      sf('bold', 9, ...(ovr === 'pass' ? [15,110,70] as [number,number,number] : [180,50,25] as [number,number,number]))
      doc.text(ovr === 'pass' ? '✓  Overall result: PASS' : '✗  Overall result: FAIL', W/2, y+5.5, { align: 'center' })
      y += 12
    }

    // Notes
    y += 3
    sf('bold', 7.5, 40, 40, 40)
    doc.text('Notes', M, y); y += 4
    const noteLines = [
      'This Certificate provides traceability of measurements to recognised national standards and to units of measurement realised at the National Physical Laboratory or other recognised national standard Laboratories',
      'UUT Error calculated from UUT Readings minus Applied Pressure',
      cert.zeroed_before_cal ? 'Unit was Zeroed before Calibration' : '',
      `Orientation: ${cert.orientation}`,
    ].filter(Boolean)
    noteLines.forEach(note => {
      sf('normal', 7, 80, 80, 80)
      const lines = doc.splitTextToSize(note, TW)
      doc.text(lines, M, y)
      y += lines.length * 4
    })

    // Sign off
    y += 5
    sf('normal', 8, 80, 80, 80)
    doc.text(`Calibrated by: ${cert.engineer?.full_name || '—'}`, M, y)
    doc.text(`Date: ${cert.calibration_date ? format(parseISO(cert.calibration_date),'dd/MM/yyyy') : '—'}`, M + 80, y)

    // Footer
    doc.setFillColor(40,40,40)
    doc.rect(0, 282, W, 15, 'F')
    doc.setFillColor(126,216,87)
    doc.rect(0, 282, W, 1, 'F')
    sf('normal', 6, 126, 216, 87)
    doc.text(COMPANY_ADDRESS, W/2, 288, { align: 'center' })
    sf('normal', 6, 150, 150, 150)
    doc.text('Pressure Gauge Calibration Certificate', M, 293)
    doc.text(`${cert.cert_number}`, W-M, 293, { align: 'right' })

    doc.save(`${cert.cert_number}.pdf`)
    showToast('PDF downloaded!')
  }

  if (loading) return <div className="p-8 text-gray-400 text-sm">Loading...</div>
  if (!cert)   return <div className="p-8 text-gray-400 text-sm">Certificate not found.</div>

  function calcRow(row: any) {
    const up = calcError(row.applied_pressure, row.reading_up)
    const dn = calcError(row.applied_pressure, row.reading_down)
    const result = !up.result && !dn.result ? null :
      up.result === 'FAIL' || dn.result === 'FAIL' ? 'FAIL' : 'PASS'
    return { up, dn, result }
  }

  return (
    <div className="p-4 max-w-3xl mx-auto pb-8">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm px-5 py-2.5 rounded-full shadow-xl">
          {toast}
        </div>
      )}

      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-xs text-gray-400 mb-1">
            <Link href="/dashboard/pressure" className="hover:text-brand-500">Pressure certificates</Link> / {cert.cert_number}
          </div>
          <h1 className="text-xl font-bold text-gray-900 font-mono">{cert.cert_number}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{cert.model} · S/N {cert.serial_number} · {cert.customer?.name}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {cert.overall_result==='pass'?<span className="badge-pass font-bold px-3 py-1">✓ PASS</span>
           :cert.overall_result==='fail'?<span className="badge-fail font-bold px-3 py-1">✗ FAIL</span>
           :<span className="badge-gray">—</span>}
          {cert.status==='complete'?<span className="badge-info">Complete</span>
           :cert.status==='draft'?<span className="badge-warn">Draft</span>
           :<span className="badge-pass">Sent</span>}
        </div>
      </div>

      {/* Actions */}
      <div className="card p-4 mb-4">
        <div className="flex gap-2">
          <button onClick={generatePDF}
            className="flex-1 py-3 rounded-xl bg-brand-500 hover:bg-brand-700 text-white text-sm font-semibold flex items-center justify-center gap-2">
            ↓ Download PDF Certificate
          </button>
        </div>
        <button onClick={handleDelete} className="w-full py-2 rounded-xl border border-red-200 bg-white hover:bg-red-50 text-red-500 text-xs font-medium mt-2">
          Delete certificate
        </button>
      </div>

      {/* Certificate details */}
      <div className="space-y-3">
        <div className="card p-4">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Unit under test</h2>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              ['Manufacturer', cert.manufacturer],
              ['Model', cert.model],
              ['Serial number', cert.serial_number],
              ['Accuracy', `${cert.accuracy_pct_fs}% FS`],
              ['Pressure range', `${cert.pressure_range} ${cert.pressure_unit}`],
              ['Vacuum range', cert.vacuum_range ? `${cert.vacuum_range} ${cert.pressure_unit}` : '—'],
              ['Type', cert.gauge_type],
              ['Connection', cert.pressure_connection],
              ['Cal date', cert.calibration_date ? format(parseISO(cert.calibration_date),'dd MMM yyyy') : '—'],
              ['Customer', cert.customer?.name],
            ].map(([l,v])=>(
              <div key={l} className="flex justify-between py-1.5 border-b border-gray-50">
                <span className="text-gray-400">{l}</span>
                <span className="text-gray-900 font-medium">{v||'—'}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-4">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Reference standard</h2>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              ['Model', cert.ref_model],
              ['Serial number', cert.ref_serial],
              ['Range', cert.ref_range],
              ['UKAS certificate', cert.ref_ukas_cert],
            ].map(([l,v])=>(
              <div key={l} className="flex justify-between py-1.5 border-b border-gray-50">
                <span className="text-gray-400">{l}</span>
                <span className="text-gray-900 font-medium">{v||'—'}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-4">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Calibration readings</h2>
          <div className="bg-green-50 rounded-lg px-3 py-2 text-xs text-green-700 mb-3">
            Tolerance: ±{cert.accuracy_pct_fs}% FS = ±{(cert.accuracy_pct_fs * cert.pressure_range / 100).toFixed(4)} {cert.pressure_unit}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 text-gray-400 uppercase">
                  <th className="py-2 text-left">Applied</th>
                  <th className="py-2 text-left">Up</th>
                  <th className="py-2 text-left">Err Up</th>
                  <th className="py-2 text-left">Down</th>
                  <th className="py-2 text-left">Err Down</th>
                  <th className="py-2 text-left">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {readings.map(row => {
                  const { up, dn, result } = calcRow(row)
                  return (
                    <tr key={row.id}>
                      <td className="py-1.5 font-mono font-semibold">{row.applied_pressure}</td>
                      <td className="py-1.5 font-mono">{row.reading_up ?? '—'}</td>
                      <td className="py-1.5 font-mono text-gray-500">{up.error ?? '—'}</td>
                      <td className="py-1.5 font-mono">{row.reading_down ?? '—'}</td>
                      <td className="py-1.5 font-mono text-gray-500">{dn.error ?? '—'}</td>
                      <td className="py-1.5">
                        {result === 'PASS' ? <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">PASS</span>
                         : result === 'FAIL' ? <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">FAIL</span>
                         : <span className="text-gray-300">—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card p-4">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Conditions</h2>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              ['Temperature', `${cert.temperature_c}°C`],
              ['Media', cert.media],
              ['Procedure', cert.calibration_procedure],
              ['Orientation', cert.orientation],
              ['Zeroed before cal', cert.zeroed_before_cal ? 'Yes' : 'No'],
              ['Engineer', cert.engineer?.full_name],
            ].map(([l,v])=>(
              <div key={l} className="flex justify-between py-1.5 border-b border-gray-50">
                <span className="text-gray-400">{l}</span>
                <span className="text-gray-900 font-medium">{v||'—'}</span>
              </div>
            ))}
          </div>
          {cert.notes && <div className="mt-3 text-xs text-gray-600 bg-gray-50 rounded-lg p-3">{cert.notes}</div>}
        </div>

        <Link href="/dashboard/pressure" className="btn-secondary text-xs py-2 w-full text-center block">
          ← Back to certificates
        </Link>
      </div>
    </div>
  )
}
