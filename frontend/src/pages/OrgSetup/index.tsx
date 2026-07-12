import { useState } from 'react';
import { Building2, Tag, Users } from 'lucide-react';
import DepartmentsTab from './DepartmentsTab';
import CategoriesTab from './CategoriesTab';
import EmployeesTab from './EmployeesTab';

const tabs = [
  { id: 'departments', label: 'Departments', icon: Building2 },
  { id: 'categories', label: 'Categories', icon: Tag },
  { id: 'employees', label: 'Employees', icon: Users },
] as const;

type TabId = (typeof tabs)[number]['id'];

export default function OrgSetup() {
  const [activeTab, setActiveTab] = useState<TabId>('departments');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Organization Setup
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage departments, asset categories, and employee directory.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 rounded-lg border border-border bg-muted p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="rounded-xl border border-border bg-card p-6 sm:p-8 shadow-sm">
        {activeTab === 'departments' && <DepartmentsTab />}
        {activeTab === 'categories' && <CategoriesTab />}
        {activeTab === 'employees' && <EmployeesTab />}
      </div>
    </div>
  );
}
