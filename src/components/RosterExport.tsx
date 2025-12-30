import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Driver {
  id: string;
  badge_number: string;
  driver_name: string;
  captain: string;
  phone: string | null;
  email: string | null;
  license_expiry: string | null;
  vehicle_number: string | null;
  status: string | null;
  notes: string | null;
}

interface RosterExportProps {
  drivers: Driver[];
}

const RosterExport = ({ drivers }: RosterExportProps) => {
  const prepareExportData = () => {
    return drivers.map((driver) => ({
      'Badge Number': driver.badge_number,
      'Driver Name': driver.driver_name,
      'Captain': driver.captain,
      'Phone': driver.phone || '',
      'Email': driver.email || '',
      'Vehicle Number': driver.vehicle_number || '',
      'License Expiry': driver.license_expiry || '',
      'Status': driver.status || '',
      'Notes': driver.notes || '',
    }));
  };

  const exportToCSV = () => {
    const data = prepareExportData();
    const ws = XLSX.utils.json_to_sheet(data);
    const csv = XLSX.utils.sheet_to_csv(ws);
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `taxi_roster_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const exportToExcel = () => {
    const data = prepareExportData();
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Roster');
    
    XLSX.writeFile(wb, `taxi_roster_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (drivers.length === 0) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={exportToCSV}>
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportToExcel}>
          Export as Excel
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default RosterExport;