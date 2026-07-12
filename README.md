# AssetFlow

AssetFlow is a modern asset management application designed to help organizations manage their assets, employees, and departments efficiently. It includes an interactive dashboard, comprehensive organization tracking, and a powerful notification system.

## Project Structure

The project is structured as a monorepo with separate frontend and backend directories:

- `/frontend`: The web client built using **React, Vite, and Tailwind CSS**.
- `/backend`: The REST API server built using **Node.js, Express, and Prisma ORM**.

## Prerequisites

Make sure you have the following installed on your machine:
- Node.js (v18 or higher recommended)
- npm or yarn
- PostgreSQL (if running locally) or a cloud-hosted Postgres database URL

## Setup Instructions

### 1. Backend Setup

Navigate to the root directory and install backend dependencies:
```bash
npm install
```

Set up your environment variables. Create a `.env` file in the `backend/` directory with the following variables:
```env
DATABASE_URL="postgresql://username:password@localhost:5432/assetflow?schema=public"
JWT_SECRET="your_super_secret_jwt_key_here"
```

Initialize the database schema using Prisma:
```bash
npx prisma db push
```
*(Alternatively, use `npx prisma migrate dev` if you prefer to generate migration files).*

Seed the database with initial data (Admin user, departments, categories, and employees):
```bash
npm run seed
```

### 2. Frontend Setup

Open a new terminal window, navigate to the `frontend` directory, and install its dependencies:
```bash
cd frontend
npm install
```

The frontend uses Vite and expects the backend to be running at `http://localhost:5000` by default.

## Running the Application

To run the application, you will need to start both the backend and frontend development servers.

**Terminal 1 (Backend):**
From the root directory, start the Express backend server:
```bash
npm run dev:backend
```
*The backend server will run on `http://localhost:5000`.*

**Terminal 2 (Frontend):**
Navigate to the `frontend` directory and start the Vite development server:
```bash
cd frontend
npm run dev
```
*The frontend server will run on `http://localhost:5173`.*

## Starting Details & Login

Once both servers are running, open your browser and navigate to `http://localhost:5173`. 

The database seed script (`npm run seed`) creates several default accounts you can use to log in immediately:

- **Admin Account**: `admin@assetflow.com` / `admin123`
- **Asset Manager**: `priya@assetflow.com` / `password123`
- **Department Head**: `rahul@assetflow.com` / `password123`
- **Employee**: `ananya@assetflow.com` / `password123`

The `Admin` account has access to the **Organisation Setup** page where you can manage departments, employees, and asset categories, as well as access the **Activity Logs** and **Reports**.

## Features Overview

- **Dashboard**: Centralized KPIs for assets, active employees, and overdue returns, alongside recent activity logs and quick actions.
- **Organization Management**: Complete CRUD interface for defining Departments, custom Asset Categories, and managing Employees with Role-Based Access Control (RBAC).
- **Notifications**: Real-time mockable updates for system activities such as role changes.
- **Role-Based Access**: Specialized views and restricted quick actions ensuring that data security is maintained across Admins, Asset Managers, Department Heads, and Employees.
