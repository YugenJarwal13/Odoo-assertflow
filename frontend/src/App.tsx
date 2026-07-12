import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AppShell from '@/layouts/AppShell';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Toaster } from '@/components/ui/toast';
import Login from '@/pages/Login';
import Signup from '@/pages/Signup';
import Dashboard from '@/pages/Dashboard';
import OrgSetup from '@/pages/OrgSetup';
import Notifications from '@/pages/Notifications';
import ActivityLog from '@/pages/ActivityLog';
import AssetsPage from '@/pages/Assets';
import AssetDetail from '@/pages/Assets/AssetDetail';
import AllocationsPage from '@/pages/Allocations';
import BookingsPage from '@/pages/Bookings';
import MaintenancePage from '@/pages/Maintenance';
import AuditsPage from '@/pages/Audits';
import AuditDetail from '@/pages/Audits/AuditDetail';
import ReportsPage from '@/pages/Reports';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          {/* Protected routes inside AppShell */}
          <Route
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />

            {/* Track A pages */}
            <Route
              path="/org"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <OrgSetup />
                </ProtectedRoute>
              }
            />
            <Route path="/notifications" element={<Notifications />} />
            <Route
              path="/activity-log"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <ActivityLog />
                </ProtectedRoute>
              }
            />

            {/* Track B pages */}
            <Route path="/assets" element={<AssetsPage />} />
            <Route path="/assets/:id" element={<AssetDetail />} />
            <Route path="/allocations" element={<AllocationsPage />} />
            <Route path="/bookings" element={<BookingsPage />} />
            <Route path="/maintenance" element={<MaintenancePage />} />
            <Route path="/audits" element={<AuditsPage />} />
            <Route path="/audits/:id" element={<AuditDetail />} />
            <Route
              path="/reports"
              element={
                <ProtectedRoute allowedRoles={['ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD']}>
                  <ReportsPage />
                </ProtectedRoute>
              }
            />
          </Route>

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster />
    </QueryClientProvider>
  );
}
