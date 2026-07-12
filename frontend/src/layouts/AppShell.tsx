import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import {
  LayoutDashboard,
  Building2,
  Bell,
  Activity,
  Package,
  CalendarDays,
  Wrench,
  ClipboardCheck,
  BarChart3,
  Menu,
  X,
  LogOut,
  ChevronDown,
} from 'lucide-react';

const allNavItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD', 'EMPLOYEE'] },
  { to: '/org', label: 'Organization', icon: Building2, roles: ['ADMIN'] },
  { to: '/assets', label: 'Assets', icon: Package, roles: ['ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD'] },
  { to: '/bookings', label: 'Bookings', icon: CalendarDays, roles: ['ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD', 'EMPLOYEE'] },
  { to: '/maintenance', label: 'Maintenance', icon: Wrench, roles: ['ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD', 'EMPLOYEE'] },
  { to: '/audits', label: 'Audits', icon: ClipboardCheck, roles: ['ADMIN', 'ASSET_MANAGER'] },
  { to: '/reports', label: 'Reports', icon: BarChart3, roles: ['ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD'] },
  { to: '/notifications', label: 'Notifications', icon: Bell, roles: ['ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD', 'EMPLOYEE'] },
  { to: '/activity-log', label: 'Activity Log', icon: Activity, roles: ['ADMIN'] },
];

const roleBadgeColors: Record<string, string> = {
  ADMIN: 'bg-primary/10 text-primary',
  ASSET_MANAGER: 'bg-blue-50 text-blue-700',
  DEPARTMENT_HEAD: 'bg-emerald-50 text-emerald-700',
  EMPLOYEE: 'bg-gray-100 text-gray-600',
};

export default function AppShell() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const userRole = user?.role || 'EMPLOYEE';
  const navItems = allNavItems.filter((item) => item.roles.includes(userRole));

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const formatRole = (role: string) =>
    role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-sidebar-border bg-sidebar
          transition-transform duration-200 ease-in-out
          lg:static lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-2.5 border-b border-sidebar-border px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Package className="h-4.5 w-4.5 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold tracking-tight text-foreground">
            AssetFlow
          </span>
          <button
            onClick={() => setSidebarOpen(false)}
            className="ml-auto rounded-md p-1 text-muted-foreground hover:text-foreground lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`
              }
            >
              <item.icon className="h-[18px] w-[18px] shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User section at bottom */}
        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-3 rounded-lg px-3 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {user?.name || 'User'}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {user?.email || ''}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-16 shrink-0 items-center gap-4 border-b border-border bg-background px-4 lg:px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex-1" />

          {/* Role badge */}
          <span
            className={`hidden rounded-full px-2.5 py-0.5 text-xs font-medium sm:inline-flex ${roleBadgeColors[userRole] || roleBadgeColors.EMPLOYEE}`}
          >
            {formatRole(userRole)}
          </span>

          {/* Notification bell */}
          <NavLink
            to="/notifications"
            className={({ isActive }) =>
              `relative rounded-md p-2 transition-colors ${
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`
            }
          >
            <Bell className="h-5 w-5" />
          </NavLink>

          {/* Profile dropdown */}
          <div className="relative">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <span className="hidden font-medium text-foreground sm:inline">
                {user?.name || 'User'}
              </span>
              <ChevronDown className="h-4 w-4" />
            </button>

            {profileOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setProfileOpen(false)}
                />
                <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-lg border border-border bg-popover p-1 shadow-lg">
                  <div className="px-3 py-2 sm:hidden">
                    <p className="text-sm font-medium text-foreground">
                      {user?.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatRole(userRole)}
                    </p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
                  >
                    <LogOut className="h-4 w-4" />
                    Log out
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
