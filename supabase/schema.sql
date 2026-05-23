-- ============================================================
-- EUROTRON INSTRUMENTS (UK) LTD
-- Instrument Management System — Database Schema
-- Paste this entire file into Supabase SQL Editor and run it
-- ============================================================

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ============================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  full_name    text not null,
  email        text not null,
  role         text not null check (role in ('admin','engineer','customer')),
  company_id   uuid,                      -- null for internal staff
  phone        text,
  created_at   timestamptz default now()
);
alter table public.profiles enable row level security;

-- ============================================================
-- CUSTOMERS
-- ============================================================
create table public.customers (
  id           uuid primary key default uuid_generate_v4(),
  name         text not null,
  address      text,
  city         text,
  postcode     text,
  country      text default 'UK',
  contact_name text,
  contact_email text,
  contact_phone text,
  notes        text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);
alter table public.customers enable row level security;

-- Link profiles to customers (for customer portal access)
alter table public.profiles
  add constraint fk_profiles_company
  foreign key (company_id) references public.customers(id) on delete set null;

-- ============================================================
-- INSTRUMENTS (gas analyser assets)
-- ============================================================
create table public.instruments (
  id                uuid primary key default uuid_generate_v4(),
  customer_id       uuid not null references public.customers(id) on delete cascade,
  asset_tag         text,                  -- customer asset/tag ID
  name              text not null,         -- e.g. "Portable Gas Analyser"
  make              text,
  model             text,
  serial_number     text,
  firmware_version  text,
  analyser_type     text,                  -- e.g. Flue Gas, Combustion, Emissions
  gases_measured    text[],                -- e.g. {CO, CO2, O2, NO, SO2}
  location          text,                  -- site/room installed
  status            text not null default 'active'
                    check (status in ('active','inactive','scrapped','on_loan')),
  last_service_date date,
  next_service_date date,
  last_cal_date     date,
  next_cal_date     date,
  cal_interval_months int default 12,
  purchase_date     date,
  warranty_expiry   date,
  notes             text,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);
alter table public.instruments enable row level security;
create index idx_instruments_customer on public.instruments(customer_id);
create index idx_instruments_next_cal on public.instruments(next_cal_date);
create index idx_instruments_status   on public.instruments(status);

-- ============================================================
-- REFERENCE STANDARDS
-- ============================================================
create table public.reference_standards (
  id              uuid primary key default uuid_generate_v4(),
  description     text not null,
  make            text,
  model           text,
  serial_number   text not null,
  certificate_no  text,
  cal_date        date,
  cal_due_date    date,
  accreditation   text,                   -- e.g. UKAS, ISO 17025
  notes           text,
  active          boolean default true,
  created_at      timestamptz default now()
);
alter table public.reference_standards enable row level security;

-- ============================================================
-- SERVICE REPORTS
-- ============================================================
create table public.service_reports (
  id                uuid primary key default uuid_generate_v4(),
  report_number     text not null unique,  -- e.g. SR-2024-0001
  instrument_id     uuid not null references public.instruments(id) on delete cascade,
  customer_id       uuid not null references public.customers(id),
  engineer_id       uuid references public.profiles(id),
  visit_date        date not null,
  visit_time        time,
  site_location     text,
  contact_name      text,
  firmware_at_visit text,
  findings          text,
  work_carried_out  text,
  recommendations   text,
  labour_hours      numeric(5,2),
  overall_result    text check (overall_result in ('pass','fail','na','incomplete')),
  status            text not null default 'draft'
                    check (status in ('draft','complete','sent')),
  pdf_url           text,                  -- Supabase Storage URL
  engineer_sig_url  text,
  customer_sig_url  text,
  customer_printed_name text,
  sent_at           timestamptz,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);
alter table public.service_reports enable row level security;
create index idx_reports_instrument on public.service_reports(instrument_id);
create index idx_reports_customer   on public.service_reports(customer_id);
create index idx_reports_date       on public.service_reports(visit_date desc);

-- ============================================================
-- REPORT REFERENCE STANDARDS (junction: which standards used per report)
-- ============================================================
create table public.report_standards (
  id            uuid primary key default uuid_generate_v4(),
  report_id     uuid not null references public.service_reports(id) on delete cascade,
  standard_id   uuid references public.reference_standards(id),
  description   text,
  make          text,
  model         text,
  serial_number text,
  certificate_no text,
  cal_due_date  date
);

-- ============================================================
-- CALIBRATION RECORDS (measurement rows per report)
-- ============================================================
create table public.calibration_records (
  id            uuid primary key default uuid_generate_v4(),
  report_id     uuid not null references public.service_reports(id) on delete cascade,
  phase         text not null check (phase in ('arrival','as_left')),
  sort_order    int default 0,
  parameter     text not null,            -- e.g. "CO at 100ppm"
  nominal       text,
  tolerance     text,
  measured      text,
  error_value   text,                     -- auto-calculated, stored for record
  result        text check (result in ('pass','fail','na'))
);
create index idx_cal_report on public.calibration_records(report_id);

-- ============================================================
-- PARTS USED (per report)
-- ============================================================
create table public.report_parts (
  id           uuid primary key default uuid_generate_v4(),
  report_id    uuid not null references public.service_reports(id) on delete cascade,
  description  text not null,
  part_number  text,
  quantity     int default 1,
  warranty     text check (warranty in ('yes','no','na'))
);

-- ============================================================
-- PARTS LIBRARY (company catalogue)
-- ============================================================
create table public.parts_library (
  id           uuid primary key default uuid_generate_v4(),
  description  text not null,
  part_number  text,
  category     text,
  notes        text,
  active       boolean default true,
  created_at   timestamptz default now()
);
alter table public.parts_library enable row level security;

-- ============================================================
-- CAL DUE ALERTS LOG
-- ============================================================
create table public.alert_log (
  id              uuid primary key default uuid_generate_v4(),
  instrument_id   uuid not null references public.instruments(id) on delete cascade,
  alert_type      text not null check (alert_type in ('cal_due','service_due','overdue')),
  days_until_due  int,
  sent_to         text,
  sent_at         timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================

-- Profiles: users see own profile; admins see all
create policy "profiles_own" on public.profiles
  for all using (auth.uid() = id);

create policy "profiles_admin" on public.profiles
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Customers: engineers/admins see all; customers see own record
create policy "customers_staff" on public.customers
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','engineer'))
  );

create policy "customers_own" on public.customers
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.company_id = id)
  );

-- Instruments: staff see all; customers see their own
create policy "instruments_staff" on public.instruments
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','engineer'))
  );

create policy "instruments_customer" on public.instruments
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.company_id = instruments.customer_id
    )
  );

-- Reports: staff see all; customers see their own
create policy "reports_staff" on public.service_reports
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','engineer'))
  );

create policy "reports_customer" on public.service_reports
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.company_id = service_reports.customer_id
    )
  );

-- Reference standards & parts library: staff only
create policy "standards_staff" on public.reference_standards
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','engineer'))
  );

create policy "parts_lib_staff" on public.parts_library
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','engineer'))
  );

-- ============================================================
-- AUTO-UPDATE updated_at TIMESTAMPS
-- ============================================================
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger trg_instruments_updated
  before update on public.instruments
  for each row execute function public.handle_updated_at();

create trigger trg_reports_updated
  before update on public.service_reports
  for each row execute function public.handle_updated_at();

create trigger trg_customers_updated
  before update on public.customers
  for each row execute function public.handle_updated_at();

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce(new.raw_user_meta_data->>'role', 'engineer')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- REPORT NUMBER SEQUENCE
-- ============================================================
create sequence if not exists report_number_seq start 1;

create or replace function public.generate_report_number()
returns trigger language plpgsql as $$
begin
  if new.report_number is null or new.report_number = '' then
    new.report_number := 'SR-' || to_char(now(), 'YYYY') || '-' ||
                         lpad(nextval('report_number_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;

create trigger trg_report_number
  before insert on public.service_reports
  for each row execute function public.generate_report_number();

-- ============================================================
-- SEED: Default parts library for gas analyser servicing
-- ============================================================
insert into public.parts_library (description, part_number, category) values
  ('Electrochemical CO sensor',      'SEN-CO-EC',    'Sensors'),
  ('Electrochemical NO sensor',      'SEN-NO-EC',    'Sensors'),
  ('Electrochemical SO2 sensor',     'SEN-SO2-EC',   'Sensors'),
  ('Paramagnetic O2 sensor',         'SEN-O2-PM',    'Sensors'),
  ('NDIR CO2 sensor module',         'SEN-CO2-IR',   'Sensors'),
  ('Zirconia O2 sensor',             'SEN-O2-ZR',    'Sensors'),
  ('Sample pump membrane',           'PMP-MEM-01',   'Pump'),
  ('Sample pump diaphragm kit',      'PMP-DIAPH-KIT','Pump'),
  ('Water trap filter element',      'FLT-WT-01',    'Filters'),
  ('PTFE particulate filter',        'FLT-PTFE-01',  'Filters'),
  ('Sample line 2m PTFE',            'TUB-PTFE-2M',  'Tubing'),
  ('Probe seal / O-ring kit',        'SEAL-PROBE-KIT','Seals'),
  ('Calibration gas adaptor',        'CAL-ADAPT-01', 'Calibration'),
  ('Charcoal scrubber cartridge',    'SCRUB-CC-01',  'Filters'),
  ('Internal battery pack',          'BAT-INT-01',   'Power'),
  ('Display screen module',          'DSP-MOD-01',   'Electronics'),
  ('Main PCB assembly',              'PCB-MAIN-01',  'Electronics'),
  ('Calibration certificate seal',   'SEAL-CAL-R',   'Admin'),
  ('Service label',                  'LABEL-SVC-01', 'Admin');

-- ============================================================
-- SEED: Common reference standards
-- ============================================================
insert into public.reference_standards (description, make, model, serial_number, accreditation) values
  ('CO span gas 1000ppm N2 balance',  'BOC Gases',    'Traceable Certified Mix', 'REF-GAS-001', 'UKAS'),
  ('CO2 span gas 15% N2 balance',     'BOC Gases',    'Traceable Certified Mix', 'REF-GAS-002', 'UKAS'),
  ('NO span gas 1000ppm N2 balance',  'BOC Gases',    'Traceable Certified Mix', 'REF-GAS-003', 'UKAS'),
  ('O2 span gas 20.9% N2 balance',    'BOC Gases',    'Traceable Certified Mix', 'REF-GAS-004', 'UKAS'),
  ('Multigas span mix CO/CO2/NO/O2',  'BOC Gases',    'Traceable Certified Mix', 'REF-GAS-005', 'UKAS'),
  ('Reference multimeter',            'Fluke',        '87V',                     'REF-DMM-001', 'UKAS'),
  ('Pressure reference gauge',        'Druck',        'DPI 705',                 'REF-PRE-001', 'UKAS');

-- Done! Schema created successfully.
-- Next step: go to src/app in your project and run: npm install
