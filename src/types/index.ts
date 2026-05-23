export type Role = 'admin' | 'engineer' | 'customer'
export type InstrumentStatus = 'active' | 'inactive' | 'scrapped' | 'on_loan'
export type ReportStatus = 'draft' | 'complete' | 'sent'
export type CalResult = 'pass' | 'fail' | 'na'
export type CalPhase = 'arrival' | 'as_left'

export interface Profile {
  id: string
  full_name: string
  email: string
  role: Role
  company_id: string | null
  phone: string | null
  created_at: string
}

export interface Customer {
  id: string
  name: string
  address: string | null
  city: string | null
  postcode: string | null
  country: string
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Instrument {
  id: string
  customer_id: string
  asset_tag: string | null
  name: string
  make: string | null
  model: string | null
  serial_number: string | null
  firmware_version: string | null
  analyser_type: string | null
  gases_measured: string[] | null
  location: string | null
  status: InstrumentStatus
  last_service_date: string | null
  next_service_date: string | null
  last_cal_date: string | null
  next_cal_date: string | null
  cal_interval_months: number
  purchase_date: string | null
  warranty_expiry: string | null
  notes: string | null
  created_at: string
  updated_at: string
  customer?: Customer
}

export interface ReferenceStandard {
  id: string
  description: string
  make: string | null
  model: string | null
  serial_number: string
  certificate_no: string | null
  cal_date: string | null
  cal_due_date: string | null
  accreditation: string | null
  notes: string | null
  active: boolean
}

export interface ServiceReport {
  id: string
  report_number: string
  instrument_id: string
  customer_id: string
  engineer_id: string | null
  visit_date: string
  visit_time: string | null
  site_location: string | null
  contact_name: string | null
  firmware_at_visit: string | null
  findings: string | null
  work_carried_out: string | null
  recommendations: string | null
  labour_hours: number | null
  overall_result: CalResult | 'incomplete' | null
  status: ReportStatus
  pdf_url: string | null
  engineer_sig_url: string | null
  customer_sig_url: string | null
  customer_printed_name: string | null
  sent_at: string | null
  created_at: string
  updated_at: string
  instrument?: Instrument
  customer?: Customer
  engineer?: Profile
  calibration_records?: CalibrationRecord[]
  report_parts?: ReportPart[]
  report_standards?: ReportStandard[]
}

export interface CalibrationRecord {
  id: string
  report_id: string
  phase: CalPhase
  sort_order: number
  parameter: string
  nominal: string | null
  tolerance: string | null
  measured: string | null
  error_value: string | null
  result: CalResult | null
}

export interface ReportPart {
  id: string
  report_id: string
  description: string
  part_number: string | null
  quantity: number
  warranty: 'yes' | 'no' | 'na' | null
}

export interface ReportStandard {
  id: string
  report_id: string
  standard_id: string | null
  description: string | null
  make: string | null
  model: string | null
  serial_number: string | null
  certificate_no: string | null
  cal_due_date: string | null
}

export interface PartLibraryItem {
  id: string
  description: string
  part_number: string | null
  category: string | null
  notes: string | null
  active: boolean
}

export interface AlertSummary {
  overdue: Instrument[]
  due_within_30: Instrument[]
  due_within_90: Instrument[]
}
