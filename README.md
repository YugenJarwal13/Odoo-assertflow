# AssetFlow — Enterprise Asset & Resource Management

AssetFlow is a modern ERP-style platform that helps organizations track assets through their full
lifecycle, allocate them with conflict rules, book shared resources without overlaps, route
maintenance through approvals, and run structured audit cycles — all backed by role-based
workflows, notifications, and a complete activity log.

## Project Structure

The project is structured as a monorepo with separate frontend and backend directories:

- `/frontend`: The web client built using **React (v19)**, **Vite**, and **Tailwind CSS (v4)**. State management and data fetching are handled by **Zustand** and **TanStack Query**. UI components are built using **shadcn/ui** and **lucide-react**, with charts by **Recharts** and QR codes via **qrcode**.
- `/backend`: The REST API server built using **Node.js**, **Express**, and **Prisma ORM**. Validation is handled via **Zod**, and authentication uses **JWT** with **bcrypt** for password hashing. Data is stored in a **PostgreSQL** database (Neon).

```
backend/src/
  lib/          prisma client, activity logger, notifications, asset lifecycle state machine, errors
  middleware/   JWT auth, role guard
  modules/      auth · org · dashboard · notifications · logs · assets · bookings · maintenance · audits · reports
```

Architecture highlights:
- **Service layer separation** — routes never touch Prisma directly (`routes → service → prisma`).
- **State machine** (`lib/assetLifecycle.ts`) — every asset status change is validated against a single allowed-transitions table.
- **Every write action** creates an `ActivityLog` row, and notifications are emitted as service side-effects.
- **Conflict rules return structured HTTP 409s**: double allocation includes the current holder; booking overlap includes the conflicting slot.

## Prerequisites

- Node.js (v20 or higher recommended)
- npm
- A PostgreSQL database URL (the team uses a shared Neon instance)

## Setup Instructions

### 1. Backend Setup

Navigate to the root directory and install backend dependencies:
```bash
npm install
```

Create a `.env` file in the `backend/` directory:
```env
DATABASE_URL="<your PostgreSQL connection string>"
JWT_SECRET="assetflow-hackathon-2026-shared-secret"
PORT=3001
```
> Both teammates must use the **same `JWT_SECRET`**, or tokens issued by one machine won't validate on the other.

Generate the Prisma client:
```bash
cd backend && npx prisma generate && cd ..
```
> The initial migration is already applied to the shared Neon DB — do **not** run `migrate dev`
> against it. For a fresh database, run `npx prisma migrate deploy` instead.

Seed the database (idempotent — skips demo assets if they already exist):
```bash
npm run seed
```

### 2. Frontend Setup

Open a new terminal, navigate to the `frontend` directory, and install its dependencies:
```bash
cd frontend
npm install
```

## Running the Application

**Terminal 1 (Backend):** from the repo root:
```bash
npm run dev:backend
```
*The API runs on `http://localhost:3001`.*

**Terminal 2 (Frontend):**
```bash
cd frontend
npm run dev
```
*The UI runs on `http://localhost:5173`.*

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

1. **Admin** → Dashboard: six KPI cards, overdue returns panel, pending-approval strips.
2. **Priya (Asset Manager)** → Assets: register an asset (tag auto-generates), open its detail page — lifecycle stepper + QR code.
3. Allocate an *available* asset to Ananya. Then try allocating an *allocated* one — the system blocks it, names the current holder, and offers **Request Transfer** instead.
4. Allocations → approve the pending transfer; open the asset's history to show the automatic trail.
5. Bookings: Conference Room Alpha calendar; book 9:30–10:30 over an existing 9:00–10:00 slot → rejected with the conflicting slot shown; 10:00–11:00 → accepted.
6. Maintenance: approve the pending request (asset flips to *Under Maintenance*), assign a technician, resolve (asset flips back).
7. Audits: open the HQ Floor 2 cycle as Priya, mark an item **Missing** with a note, verify the rest, close the cycle → discrepancy report + missing asset auto-flips to **Lost**.
8. Reports: status donut, most-used assets, booking heatmap, department summary + CSV export.
9. Log in as **Ananya (Employee)** — a genuinely different UI: My Assets, bookings, maintenance, live notification bell.

## Features Overview

- **Authentication & Security**: JWT + bcrypt, role-based middleware, realistic non-self-elevating signup.
- **Dashboard**: Six KPI cards (Available, Allocated, Maintenance Today, Active Bookings, Pending Transfers, Upcoming Returns), overdue returns highlighted separately, quick actions, fleet-by-status breakdown, recent activity.
- **Organization Management**: CRUD for Departments (with heads/hierarchy), Asset Categories (custom fields), and the Employee Directory with role promotion.
- **Asset Registry**: Auto-generated tags (AF-0001…), search/filter by tag, serial, category, status, location; per-asset QR code, lifecycle stepper, and full allocation/transfer/maintenance history.
- **Allocation & Transfers**: Double-allocation is blocked with the holder named and a Transfer Request offered; transfers go through approval and re-allocate with history updated automatically; returns capture condition check-in notes; overdue returns are auto-flagged.
- **Resource Booking**: Week-calendar per resource, overlap validation (back-to-back slots allowed), cancel/reschedule, statuses auto-roll Upcoming → Ongoing → Completed.
- **Maintenance**: Pending → Approved/Rejected → Technician Assigned → In Progress → Resolved, with the asset flipping to Under Maintenance on approval and restored on resolution.
- **Audits**: Scoped cycles auto-pull assets, assigned auditors mark Verified/Missing/Damaged, auto-generated discrepancy report (CSV export), closing flips confirmed-missing assets to Lost.
- **Reports & Analytics**: Utilization (most-used vs idle), maintenance frequency by category, booking heatmap (peak windows), department-wise allocation summary with CSV export.
- **Activity Logs & Notifications**: Every write is audit-logged; notifications fire on assignments, approvals, bookings, discrepancies — with a live unread badge.

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
