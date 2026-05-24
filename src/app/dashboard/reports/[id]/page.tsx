'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useParams } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import Link from 'next/link'
import { downloadReportPDF, sendReportByEmail, buildMailtoLink } from '@/lib/email'
import type { ReportData } from '@/lib/generatePDF'

function ResultBadge({ result }: { result: string | null }) {
  if (result === 'pass') return <span className="badge-pass font-bold px-3 py-1">PASS</span>
  if (result === 'fail') return <span className="badge-fail font-bold px-3 py-1">FAIL</span>
  return <span className="badge-gray">—</span>
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'sent')     return <span className="badge-pass">Sent</span>
  if (status === 'complete') return <span className="badge-info">Complete</span>
  return <span className="badge-warn">Draft</span>
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between py-2 border-b border-gray-50 last:border-0 gap-4">
      <span className="text-gray-400 text-xs shrink-0">{label}</span>
      <span className="text-gray-900 text-right text-xs">{value || '—'}</span>
    </div>
  )
}

function CalTable({ rows, title }: { rows: any[]; title: string }) {
  if (!rows.length) return null
  return (
    <div className="card p-4">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{title}</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-xs" style={{ minWidth: 400 }}>
          <thead>
            <tr className="border-b border-gray-100 text-gray-400">
              <th className="text-left py-1.5 px-1 w-1/4">Parameter</th>
              <th className="text-left py-1.5 px-1">Nominal</th>
              <th className="text-left py-1.5 px-1">Tol.</th>
              <th className="text-left py-1.5 px-1">Measured</th>
              <th className="text-left py-1.5 px-1 font-mono">Error</th>
              <th className="text-left py-1.5 px-1">Result</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map((r: any) => (
              <tr key={r.id}>
                <td className="py-2 px-1 font-medium text-gray-800">{r.parameter || '—'}</td>
                <td className="py-2 px-1 text-gray-600">{r.nominal || '—'}</td>
                <td className="py-2 px-1 text-gray-500">{r.tolerance || '—'}</td>
                <td className="py-2 px-1 font-semibold text-gray-800">{r.measured || '—'}</td>
                <td className="py-2 px-1 font-mono text-gray-500">{r.error_value || '—'}</td>
                <td className="py-2 px-1">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${r.result==='pass'?'bg-green-100 text-green-700':r.result==='fail'?'bg-red-100 text-red-700':'bg-gray-100 text-gray-500'}`}>
                    {r.result==='pass'?'Pass':r.result==='fail'?'Fail':'—'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function ReportDetailPage() {
  const { id }   = useParams<{ id: string }>()
  const [report, setReport]         = useState<any>(null)
  const [loading, setLoading]       = useState(true)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [emailLoading, setEmailLoading] = useState(false)
  const [progress, setProgress]     = useState('')
  const [toast, setToast]           = useState('')
  const supabase = createClient()

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3500) }

  useEffect(() => {
    supabase.from('service_reports')
      .select(`*, instrument:instruments(*), customer:customers(*),
               engineer:profiles(full_name,email),
               calibration_records(*), report_parts(*), report_standards(*)`)
      .eq('id', id).single()
      .then(({ data }) => { setReport(data); setLoading(false) })
  }, [id])

  async function handleDownloadPDF() {
    if (!report) return
    setPdfLoading(true)
    try { downloadReportPDF(report as ReportData); showToast('PDF saved to your device') }
    catch { showToast('PDF error — please try again') }
    setPdfLoading(false)
  }

  async function handleSendEmail() {
    if (!report) return
    if (!report.customer?.contact_email) { showToast('No customer email on file'); return }
    setEmailLoading(true)
    const result = await sendReportByEmail(report as ReportData, report.id, msg => setProgress(msg))
    setEmailLoading(false); setProgress('')
    if (result.success) {
      setReport((r: any) => ({ ...r, status: 'sent', pdf_url: result.pdfUrl ?? r.pdf_url }))
      showToast('PDF uploaded & email app opened')
    } else {
      showToast('Error: ' + result.error)
    }
  }

  function handleQuickEmail() {
    if (!report) return
    if (!report.customer?.contact_email) { showToast('No customer email on file'); return }
    window.location.href = buildMailtoLink(report as ReportData, report.pdf_url)
  }

  if (loading) return <div className="p-8 text-gray-400 text-sm">Loading report...</div>
  if (!report) return <div className="p-8 text-gray-400 text-sm">Report not found.</div>

  const arrival = (report.calibration_records ?? []).filter((r: any) => r.phase === 'arrival').sort((a:any,b:any)=>a.sort_order-b.sort_order)
  const asLeft  = (report.calibration_records ?? []).filter((r: any) => r.phase === 'as_left').sort((a:any,b:any)=>a.sort_order-b.sort_order)

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
            <Link href="/dashboard/reports" className="hover:text-brand-500">Reports</Link> / {report.report_number}
          </div>
          <h1 className="text-xl font-bold text-gray-900 font-mono">{report.report_number}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{report.instrument?.name} · {report.customer?.name}</p>
          {report.sage_number && (
            <div className="mt-1 inline-flex items-center gap-1.5 bg-brand-50 text-brand-700 text-xs font-medium px-2.5 py-1 rounded-full">
              <span>Sage:</span><span className="font-mono">{report.sage_number}</span>
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0 ml-4">
          <StatusBadge status={report.status} />
          <ResultBadge result={report.overall_result} />
        </div>
      </div>

      <div className="card p-4 mb-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">PDF & email</p>
        <div className="flex gap-2 mb-2">
          <button onClick={handleDownloadPDF} disabled={pdfLoading}
            className="flex-1 py-3 rounded-xl bg-brand-500 hover:bg-brand-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {pdfLoading ? <span className="animate-pulse">Generating...</span> : '↓ Download PDF'}
          </button>
          <button onClick={handleSendEmail} disabled={emailLoading}
            className="flex-1 py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {emailLoading ? <span className="animate-pulse">{progress || 'Working...'}</span> : '✉ PDF + Email'}
          </button>
        </div>
        {report.pdf_url && (
          <div className="flex gap-2">
            <button onClick={handleQuickEmail} className="flex-1 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-xs font-medium flex items-center justify-center gap-1.5">
              ✉ Re-send (existing PDF)
            </button>
            <a href={report.pdf_url} target="_blank" rel="noopener noreferrer"
              className="flex-1 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-xs font-medium flex items-center justify-center gap-1.5">
              View saved PDF
            </a>
          </div>
        )}
        {progress && <div className="mt-2 text-xs text-brand-600 bg-brand-50 rounded-lg px-3 py-2">{progress}</div>}
        {!report.customer?.contact_email && (
          <p className="mt-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">No customer email on file.</p>
        )}
      </div>

      <div className="space-y-3">
        <div className="card p-4">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Visit details</h2>
          <Row label="Date" value={report.visit_date ? format(parseISO(report.visit_date),'dd MMM yyyy') : null} />
          <Row label="Time" value={report.visit_time} />
          <Row label="Site / location" value={report.site_location} />
          <Row label="Contact on site" value={report.contact_name} />
          <Row label="Engineer" value={report.engineer?.full_name ?? report.engineer?.email} />
          <Row label="Sage sales number" value={report.sage_number} />
          <Row label="Labour hours" value={report.labour_hours ? `${report.labour_hours} hr(s)` : null} />
        </div>

        <div className="card p-4">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Instrument</h2>
          <Row label="Name" value={report.instrument?.name} />
          <Row label="Make / model" value={`${report.instrument?.make??''} ${report.instrument?.model??''}`.trim()||null} />
          <Row label="Serial number" value={report.instrument?.serial_number} />
          <Row label="Asset tag" value={report.instrument?.asset_tag} />
          <Row label="Firmware" value={report.firmware_at_visit} />
          <Row label="Gases measured" value={report.instrument?.gases_measured?.join(', ')} />
          <Row label="Next cal due" value={report.instrument?.next_cal_date ? format(parseISO(report.instrument.next_cal_date),'dd MMM yyyy') : null} />
        </div>

        {report.report_standards?.length > 0 && (
          <div className="card p-4">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Reference standards used</h2>
            {report.report_standards.map((s: any, i: number) => (
              <div key={s.id} className="mb-3 pb-3 border-b border-gray-50 last:border-0 last:mb-0 last:pb-0">
                <div className="text-xs font-semibold text-gray-700 mb-1">Standard {i+1} — {s.description}</div>
                <Row label="S/N" value={s.serial_number} />
                <Row label="Cert no." value={s.certificate_no} />
                <Row label="Cal due" value={s.cal_due_date} />
              </div>
            ))}
          </div>
        )}

        <CalTable rows={arrival} title="On arrival (as found)" />
        <CalTable rows={asLeft}  title="As left (after service)" />

        {(report.findings || report.work_carried_out || report.recommendations) && (
          <div className="card p-4 space-y-3">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Service notes</h2>
            {report.findings && <div><p className="text-xs text-gray-400 mb-1">Findings</p><p className="text-sm text-gray-800 whitespace-pre-wrap">{report.findings}</p></div>}
            {report.work_carried_out && <div><p className="text-xs text-gray-400 mb-1">Work carried out</p><p className="text-sm text-gray-800 whitespace-pre-wrap">{report.work_carried_out}</p></div>}
            {report.recommendations && <div><p className="text-xs text-gray-400 mb-1">Recommendations</p><p className="text-sm text-gray-800 whitespace-pre-wrap">{report.recommendations}</p></div>}
          </div>
        )}

        {report.report_parts?.length > 0 && (
          <div className="card p-4">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Parts used</h2>
            {report.report_parts.map((p: any, i: number) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                <div>
                  <span className="text-sm text-gray-800">{p.description}</span>
                  {p.part_number && <span className="text-xs text-gray-400 ml-1">[{p.part_number}]</span>}
                  <span className="text-xs text-gray-400 ml-1">x {p.quantity}</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ml-2 shrink-0 ${p.warranty==='yes'?'bg-green-100 text-green-700':p.warranty==='no'?'bg-red-100 text-red-600':'bg-gray-100 text-gray-500'}`}>
                  {p.warranty==='yes'?'Warranty':p.warranty==='no'?'No warranty':'—'}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="card p-4">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Sign-off</h2>
          <Row label="Customer name" value={report.customer_printed_name} />
          <Row label="Report sent" value={report.sent_at ? format(parseISO(report.sent_at),'dd MMM yyyy HH:mm') : null} />
        </div>

        <div className="flex gap-2 pt-1">
          <Link href={`/dashboard/instruments/${report.instrument_id}`} className="btn-secondary text-xs py-2 flex-1 text-center">Instrument record</Link>
          <Link href="/dashboard/reports/new" className="btn-primary text-xs py-2 flex-1 text-center">+ New report</Link>
        </div>
      </div>
    </div>
  )
}
