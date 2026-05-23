import { generateReportPDF, ReportData } from './generatePDF'
import { createClient } from './supabase'

/**
 * Generate PDF, upload to Supabase Storage, return public URL
 */
export async function uploadReportPDF(report: ReportData): Promise<string | null> {
  const supabase = createClient()
  const doc      = generateReportPDF(report)
  const blob     = doc.output('blob')
  const filename = `${report.report_number}.pdf`

  const { data, error } = await supabase.storage
    .from('reports')
    .upload(filename, blob, {
      contentType: 'application/pdf',
      upsert: true,
    })

  if (error) {
    console.error('PDF upload error:', error)
    return null
  }

  const { data: { publicUrl } } = supabase.storage
    .from('reports')
    .getPublicUrl(filename)

  return publicUrl
}

/**
 * Download PDF directly to device (no upload needed)
 */
export function downloadReportPDF(report: ReportData) {
  const doc = generateReportPDF(report)
  doc.save(`${report.report_number}.pdf`)
}

/**
 * Build a mailto: link pre-filled with report details
 * Opens the device email app with To, Subject and Body ready
 */
export function buildMailtoLink(report: ReportData, pdfUrl?: string | null): string {
  const email   = report.customer?.contact_email ?? ''
  const custName = report.customer?.name ?? 'Customer'
  const instName = report.instrument?.name ?? 'instrument'
  const serial   = report.instrument?.serial_number
  const engineer = report.engineer?.full_name ?? 'Eurotron Instruments (UK) Ltd'
  const dateStr  = report.visit_date
    ? new Date(report.visit_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
    : ''
  const result   = report.overall_result === 'pass' ? 'PASS ✓' : report.overall_result === 'fail' ? 'FAIL ✗' : 'N/A'
  const nextCal  = report.instrument?.next_cal_date ?? ''

  const subject = `Service & Calibration Report ${report.report_number} — ${custName} — ${dateStr}`

  const body = [
    `Dear ${custName},`,
    '',
    `Please find ${pdfUrl ? 'attached' : 'below details of'} the service and calibration report for the visit carried out on ${dateStr}.`,
    '',
    `────────────────────────────────────`,
    `Report number    : ${report.report_number}`,
    `Instrument       : ${instName}${serial ? ` (S/N: ${serial})` : ''}`,
    `Overall result   : ${result}`,
    `Visit date       : ${dateStr}`,
    nextCal ? `Next cal due     : ${new Date(nextCal).toLocaleDateString('en-GB', { day:'2-digit', month:'long', year:'numeric' })}` : '',
    `────────────────────────────────────`,
    '',
    pdfUrl
      ? `You can download your report PDF here:\n${pdfUrl}`
      : 'The PDF report is attached to this email.',
    '',
    'This report includes full calibration data (as-found and as-left measurements), reference standards used, parts fitted, and engineer sign-off.',
    '',
    'If you have any questions regarding this report or would like to schedule your next calibration visit, please do not hesitate to contact us.',
    '',
    'Kind regards,',
    engineer,
    'Eurotron Instruments (UK) Ltd',
    'Gas Analyser Calibration & Service Specialists',
  ].filter(l => l !== null).join('\n')

  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

/**
 * Full send flow:
 * 1. Generate PDF
 * 2. Upload to Supabase Storage
 * 3. Update report record with pdf_url and status='sent'
 * 4. Open email app via mailto with PDF download link in body
 */
export async function sendReportByEmail(
  report: ReportData,
  reportId: string,
  onProgress?: (msg: string) => void
): Promise<{ success: boolean; pdfUrl?: string; error?: string }> {
  const supabase = createClient()

  try {
    onProgress?.('Generating PDF…')
    const pdfUrl = await uploadReportPDF(report)

    onProgress?.('Updating report record…')
    await supabase.from('service_reports').update({
      pdf_url:  pdfUrl,
      status:   'sent',
      sent_at:  new Date().toISOString(),
    }).eq('id', reportId)

    onProgress?.('Opening email app…')
    const mailto = buildMailtoLink(report, pdfUrl)
    window.location.href = mailto

    return { success: true, pdfUrl: pdfUrl ?? undefined }
  } catch (err: any) {
    return { success: false, error: err?.message ?? 'Unknown error' }
  }
}
