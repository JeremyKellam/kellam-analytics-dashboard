# Kellam Analytics Dashboard

Business management app for Kellam Analytics LLC (engineering/analytics contracting).

## URLs
- Frontend: https://kellam-analytics-dashboard.vercel.app
- Backend: https://kellam-analytics-dashboard.onrender.com
- GitHub: https://github.com/JeremyKellam/kellam-analytics-dashboard

## Stack
React (Vercel) + Node/Express (Render) + PostgreSQL (Supabase) + Supabase Storage (invoices/receipts)

## Auth
Shared API key. Server checks `Authorization: Bearer <key>` on all routes except `/api/health`. Key is `API_KEY` env var on Render. Frontend stores key in localStorage, sends as Bearer token; on 401 clears localStorage and reloads.

## Hosting & Keep-Alive
- Render free tier spins down after 15 min inactivity. Cold start ~30-60s.
- Same keep-alive setup as property dashboard may be needed.

## Environment Variables (Render)
- `DATABASE_URL` — Supabase pooler URL (port 6543, with `?pgbouncer=true`)
- `API_KEY` — shared auth key
- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_SERVICE_KEY` — service_role secret (for storage)
- `ANTHROPIC_API_KEY` — for Claude invoice parsing (claude-sonnet-4-6)
- `NODE_ENV` — `production`
- `NODE_OPTIONS` — `--dns-result-order=ipv4first` (required for Render→Supabase IPv4)

## Database Schema
- `invoices` — id, client, invoice_number, invoice_date, due_date, amount, paid (boolean), receipt_path, created_at, updated_at
- `expenses` — id, year, month, category, amount, description, expense_date, receipt_path, created_at
- `trips` — id, trip_date, miles, purpose

Schema migrations run at server startup (`CREATE TABLE IF NOT EXISTS`).

## Expense Categories (DB constraint values)
`advertising`, `contract_labor`, `depreciation`, `professional_fees`, `office_expense`, `supplies`, `taxes_licenses`, `travel`, `meals`, `utilities`, `other`

## Schedule C Line Mapping
- Line 1: Gross Income (from invoices)
- Line 9: Car & truck (mileage @ IRS rate, from trips)
- Line 11: Contract labor
- Line 13: Depreciation
- Line 17: Legal & professional fees (professional_fees)
- Line 18: Office expense (office_expense)
- Line 22: Supplies
- Line 23: Taxes & licenses (taxes_licenses)
- Line 24a: Travel
- Line 24b: Meals
- Line 25: Utilities
- Line 27a: Other (advertising + other)
- Net Profit: Line 1 minus all expense lines

## UI Patterns
- Edit forms expand inline under the row
- All tabs use year selector at top
- PWA name: "Kellam Analytics"
- Supabase Storage buckets: `invoices` (invoice files), `receipts` (expense receipts)

## Excel Export
`/api/export?year=YYYY` generates 4-sheet workbook:
1. Summary (Schedule C)
2. Income (invoices)
3. Expenses
4. Trips
