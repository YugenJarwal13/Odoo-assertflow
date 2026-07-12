import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AppShell from '@/layouts/AppShell';
import ProtectedRoute from '@/components/ProtectedRoute';
import Login from '@/pages/Login';
import Signup from '@/pages/Signup';
import Dashboard from '@/pages/Dashboard';
import OrgSetup from '@/pages/OrgSetup';
import Notifications from '@/pages/Notifications';
import ActivityLog from '@/pages/ActivityLog';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

// Placeholder for Track B pages — renders nothing, Track B will replace these
function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
      <p className="text-lg font-medium">{title}</p>
      <p className="text-sm">Coming soon</p>
    </div>
  );
}

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

            {/* Track B placeholder routes — nav links won't 404 */}
            <Route path="/assets/*" element={<PlaceholderPage title="Assets" />} />
            <Route path="/bookings" element={<PlaceholderPage title="Bookings" />} />
            <Route path="/maintenance" element={<PlaceholderPage title="Maintenance" />} />
            <Route path="/audits" element={<PlaceholderPage title="Audits" />} />
            <Route path="/reports" element={<PlaceholderPage title="Reports" />} />
          </Route>

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
