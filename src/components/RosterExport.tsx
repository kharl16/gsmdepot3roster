import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Driver } from '@/types/driver';

interface RosterExportProps {
  drivers: Driver[];
}

const RosterExport = ({ drivers }: RosterExportProps) => {
  const prepareExportData = () => {
    return drivers.map((driver) => ({
      'PLATE': driver.plate,
      'ID': driver.employee_id,
      'NAME': driver.name,
      'PHONE': driver.phone || '',
      'TELEGRAM': driver.telegram_phone || '',
      'Captain': driver.captain,
      'Schedule': driver.schedule || '',
      'RD': driver.rest_day || '',
      'Status': driver.status || '',
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
