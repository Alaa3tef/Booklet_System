export type WorkflowThemeColor = 'blue' | 'green' | 'navy' | 'purple' | 'teal';

export type WorkflowNavKey =
  | 'home'
  | 'planning'
  | 'printing'
  | 'quality'
  | 'packing'
  | 'archiving'
  | 'reports';

export interface WorkflowMiniNavItem {
  key: WorkflowNavKey;
  label: string;
  icon: string;
  route: string;
}

export interface WorkflowStatusRow {
  index: number;
  committeeNumber?: string;
  subject: string;
  governorate?: string;
  location?: string;
  status: string;
  statusTone: 'success' | 'warning' | 'danger' | 'info';
}

export const WORKFLOW_MINI_NAV: WorkflowMiniNavItem[] = [
  { key: 'home', label: 'الصفحة الرئيسية', icon: 'pi pi-home', route: '/dashboard' },
  { key: 'planning', label: 'الإعداد', icon: 'pi pi-sliders-h', route: '/workflow/planning' },
  { key: 'printing', label: 'الطباعة', icon: 'pi pi-print', route: '/workflow/printing' },
  { key: 'quality', label: 'الجودة', icon: 'pi pi-verified', route: '/workflow/quality' },
  { key: 'packing', label: 'التغليف', icon: 'pi pi-box', route: '/workflow/packing' },
  { key: 'archiving', label: 'التخزين', icon: 'pi pi-database', route: '/workflow/archiving' },
  { key: 'reports', label: 'التقارير', icon: 'pi pi-chart-bar', route: '/reports' }
];
