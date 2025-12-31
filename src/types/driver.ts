export interface Driver {
  id: string;
  plate: string;
  employee_id: string;
  name: string;
  phone: string | null;
  telegram_phone: string | null;
  captain: string;
  schedule: string | null;
  rest_day: string | null;
  status: string | null;
  created_at?: string;
  updated_at?: string;
}

export type ColumnKey = 
  | 'plate' 
  | 'employee_id' 
  | 'name' 
  | 'phone' 
  | 'telegram' 
  | 'captain' 
  | 'schedule' 
  | 'rest_day' 
  | 'status';

export interface ColumnDef {
  key: ColumnKey;
  label: string;
  sortable: boolean;
}

export const DEFAULT_COLUMNS: ColumnDef[] = [
  { key: 'plate', label: 'PLATE', sortable: true },
  { key: 'employee_id', label: 'ID', sortable: true },
  { key: 'name', label: 'NAME', sortable: true },
  { key: 'phone', label: 'PHONE (Call)', sortable: false },
  { key: 'telegram', label: 'TELEGRAM (Chat)', sortable: false },
  { key: 'captain', label: 'Captain', sortable: true },
  { key: 'schedule', label: 'Schedule', sortable: true },
  { key: 'rest_day', label: 'RD', sortable: true },
  { key: 'status', label: 'Status', sortable: true },
];
