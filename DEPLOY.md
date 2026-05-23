# Eurotron IMS — Deployment Guide
## Get your system live in ~20 minutes

---

## STEP 1 — Create your Supabase database (5 min)

1. Go to https://supabase.com and sign up (free)
2. Click "New project" — name it `eurotron-ims`
3. Choose a strong database password (save it!)
4. Wait ~2 minutes for the project to be created
5. Go to **SQL Editor** (left sidebar)
6. Click "New query"
7. Open the file `supabase/schema.sql` from this project
8. Paste the entire contents into the SQL editor
9. Click **Run** — you should see "Success" at the bottom
10. Go to **Project Settings → API**
11. Copy your **Project URL** and **anon public key** — you'll need them next

---

## STEP 2 — Configure environment variables (2 min)

1. In the project folder, copy `.env.example` to `.env.local`:
   ```
   cp .env.example .env.local
   ```
2. Open `.env.local` and fill in:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
   ```

---

## STEP 3 — Run locally to test (3 min)

```bash
npm install
npm run dev
```

Open http://localhost:3000 in your browser.

You'll be redirected to the login page. You need to create your first admin user:

1. Go to your Supabase dashboard → **Authentication → Users**
2. Click "Invite user" or "Add user"
3. Enter your email and a password
4. After creating, go to **Table Editor → profiles**
5. Find your user row and set `role` to `admin`
6. Log in at http://localhost:3000/auth

---

## STEP 4 — Deploy to Vercel (5 min)

1. Go to https://vercel.com and sign up (free)
2. Install Vercel CLI: `npm install -g vercel`
3. In the project folder run: `vercel`
4. Follow the prompts (link to your Vercel account)
5. When asked about environment variables, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
6. Vercel gives you a URL like `https://eurotron-ims.vercel.app`

**That's your live URL — share it with your engineers!**

---

## STEP 5 — Add your engineers (2 min)

For each engineer:
1. Supabase dashboard → Authentication → Users → Add user
2. Set their email and temporary password
3. In Table Editor → profiles, set their `role` to `engineer`
4. Send them the Vercel URL and their login

---

## STEP 6 — Add customer portal users (2 min)

For each customer who needs portal access:
1. First create the customer in the app (Customers → Add customer)
2. Supabase → Authentication → Add user with their email
3. In profiles table, set `role` to `customer` and `company_id` to their customer UUID
4. They log in and see only their own instruments and reports

---

## STEP 7 — Access from iPhone

Simply open your Vercel URL in Safari on your iPhone.
- Tap the share button → "Add to Home Screen"
- It behaves like a native app, full screen

For the field service report, go to:
`https://your-app.vercel.app/reports/new?instrument=INSTRUMENT_ID`

Or from the Instruments list, tap "New report" next to any instrument.

---

## Database tables summary

| Table | Purpose |
|-------|---------|
| `profiles` | All users (engineers, admins, customers) |
| `customers` | Your client companies |
| `instruments` | Gas analysers — one row per asset |
| `reference_standards` | Your calibration reference equipment |
| `service_reports` | One row per site visit |
| `calibration_records` | Individual measurement rows (as-found / as-left) |
| `report_parts` | Parts used per report |
| `report_standards` | Reference standards used per report |
| `parts_library` | Your parts catalogue (pre-seeded with 19 items) |
| `alert_log` | History of calibration reminder emails sent |

---

## Security notes

- Row Level Security (RLS) is enabled on all tables
- Customers can only see their own instruments and reports
- Engineers see everything but cannot change user roles
- Only admins can manage users and system settings
- All data stays in your Supabase project — you own it

---

## Support

If you hit any issues, come back to this Claude chat and describe the error —
I'll help you fix it immediately.
