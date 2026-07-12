# AssetFlow — Enterprise Asset & Resource Management

A full-stack ERP-style platform for tracking assets through their lifecycle, allocating them with
conflict rules, booking shared resources without overlaps, routing maintenance through approvals,
and running structured audit cycles — all backed by role-based workflows, notifications, and a
complete activity log.

**Stack:** React 19 + Vite + Tailwind v4 · Express 5 + TypeScript · Prisma + PostgreSQL (Neon) · JWT auth

---

## Quick Start

### 1. Prerequisites
- Node.js ≥ 20
- npm

### 2. Install dependencies
```bash
# from the repo root — installs backend deps
npm install

# frontend deps
cd frontend && npm install && cd ..
```

### 3. Configure the backend
Create `backend/.env`:
```env
DATABASE_URL="<your Neon PostgreSQL connection string>"
JWT_SECRET="assetflow-hackathon-2026-shared-secret"
PORT=3001
```

### 4. Generate the Prisma client
```bash
cd backend && npx prisma generate && cd ..
```
> The initial migration is already applied to the shared Neon DB — do **not** run `migrate dev`
> unless you're pointing at a fresh database (then run `npx prisma migrate deploy`).

### 5. Seed demo data (idempotent — skips if assets already exist)
```bash
npm run seed
```

### 6. Run it (two terminals)
```bash
# Terminal 1 — API on http://localhost:3001
npm run dev:backend

# Terminal 2 — UI on http://localhost:5173
cd frontend && npm run dev
```

Open **http://localhost:5173** and log in.

## Demo Credentials

| Role | Email | Password |
|---|---|---|
| Admin | `admin@assetflow.com` | `admin123` |
| Asset Manager | `priya@assetflow.com` | `password123` |
| Department Head | `rahul@assetflow.com` | `password123` |
| Employee | `ananya@assetflow.com` | `password123` |

Signup always creates an **Employee** account — roles are granted only by the Admin from
Organization → Employee Directory (no self-assigned admins).

## 2-Minute Demo Script

1. **Admin** → Dashboard: six KPI cards, overdue returns panel (2 seeded), pending-approval strips.
2. **Priya (Asset Manager)** → Assets: register an asset (tag auto-generates), open its detail page
   — lifecycle stepper + QR code.
3. Allocate an *available* asset to Ananya. Then try allocating an *allocated* one — the system
   blocks it, names the current holder, and offers **Request Transfer** instead.
4. Allocations tab → approve the pending transfer; open the asset's history to show the automatic trail.
5. Bookings: Conference Room Alpha calendar; book 9:30–10:30 over an existing 9:00–10:00 slot →
   rejected with the conflicting slot; 10:00–11:00 → accepted.
6. Maintenance: approve Sneha's pending request (asset flips to *Under Maintenance*), assign
   technician, resolve (asset flips back).
7. Audits: open the HQ Floor 2 cycle as Priya, mark an item **Missing** with a note, verify the rest,
   close the cycle → discrepancy report + asset auto-flips to **Lost**.
8. Reports: status donut, most-used assets, booking heatmap, department summary + CSV export.
9. Log in as **Ananya (Employee)** — a genuinely different UI: My Assets, bookings, maintenance,
   notifications bell with live unread count.

## Architecture

```
frontend/   React + Vite + Tailwind v4 — pages per module, shared UI primitives
backend/
  src/
    lib/          prisma client, activity logger, notifications, asset lifecycle state machine, errors
    middleware/   JWT auth, role guard
    modules/      auth · org · dashboard · notifications · logs · assets · bookings · maintenance · audits · reports
  prisma/         schema, migrations, seed
```

- **Service layer separation** — routes never touch Prisma directly (`routes → service → prisma`).
- **State machine** (`lib/assetLifecycle.ts`) — every asset status change is validated against a
  single allowed-transitions table.
- **Every write action** creates an `ActivityLog` row and notifications are emitted as service
  side-effects (allocations, transfers, maintenance decisions, audit discrepancies…).
- **Conflict rules enforced in the DB layer**: double allocation → HTTP 409 with holder details;
  booking overlap → HTTP 409 with the conflicting slot.

## API Overview

```
POST /api/auth/signup · login          GET /api/auth/me
GET|POST|PATCH /api/departments · /api/categories · /api/employees
GET  /api/dashboard/kpis               GET /api/notifications · /api/activity-logs
GET|POST /api/assets                   GET /api/assets/:id · /:id/history
POST /api/assets/:id/allocate · /:id/transfer-request
GET  /api/allocations                  POST /api/allocations/:id/return
GET  /api/transfers                    PATCH /api/transfers/:id/decision
GET|POST|PATCH /api/bookings           (PATCH = cancel/reschedule, overlap-validated)
GET|POST /api/maintenance              PATCH /api/maintenance/:id/{decision,assign-technician,start,resolve}
GET|POST /api/audits                   POST /api/audits/:id/{assign-auditor,close} · PATCH /:id/items/:itemId
GET  /api/reports/{utilization,maintenance-frequency,booking-heatmap,department-summary}
```

All responses use a consistent `{ data }` / `{ error, details? }` shape.
