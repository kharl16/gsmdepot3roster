import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Download, FileSpreadsheet, Table, ChevronDown, Contact, Printer, Settings2 } from 'lucide-react';
import { Driver } from '@/types/driver';
import { normalizePhoneToE164, formatPhoneForDisplay } from '@/lib/phone-utils';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

interface RosterShareActionsProps {
  drivers: Driver[];
  selectedDrivers: Driver[];
}

const VCF_BATCH_SIZE = 100;

type ExportColumn = {
  key: keyof Driver | 'formattedPhone' | 'formattedTelegram' | 'formattedCaptain';
  label: string;
  getValue: (d: Driver) => string;
};

const ALL_EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'plate', label: 'Plate', getValue: (d) => d.plate },
  { key: 'employee_id', label: 'Employee ID', getValue: (d) => d.employee_id },
  { key: 'name', label: 'Name', getValue: (d) => d.name },
  { key: 'formattedPhone', label: 'Phone', getValue: (d) => formatPhoneForDisplay(d.phone) },
  { key: 'formattedTelegram', label: 'Telegram Phone', getValue: (d) => formatPhoneForDisplay(d.telegram_phone) },
  { key: 'formattedCaptain', label: 'Captain', getValue: (d) => d.captain === '0' ? 'Unassigned' : d.captain },
  { key: 'schedule', label: 'Schedule', getValue: (d) => d.schedule || '' },
  { key: 'rest_day', label: 'Rest Day', getValue: (d) => d.rest_day || '' },
  { key: 'status', label: 'Status', getValue: (d) => d.status || '' },
];

const DEFAULT_SELECTED_COLUMNS = ALL_EXPORT_COLUMNS.map(c => c.key);
const STORAGE_KEY = 'roster-export-columns';

const getStoredColumns = (): string[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as string[];
      // Validate that stored columns still exist
      const validKeys = ALL_EXPORT_COLUMNS.map(c => c.key as string);
      return parsed.filter((key) => validKeys.includes(key));
    }
  } catch {
    // Invalid JSON, return default
  }
  return DEFAULT_SELECTED_COLUMNS;
};

export function RosterShareActions({ drivers, selectedDrivers }: RosterShareActionsProps) {
  const { isAdmin } = useAuth();
  const [showVcfBatchModal, setShowVcfBatchModal] = useState(false);
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState<string[]>(getStoredColumns);
  const [pendingExportType, setPendingExportType] = useState<'csv' | 'xlsx' | 'print' | null>(null);

  // Persist column selection to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedColumns));
  }, [selectedColumns]);

  const driversToUse = selectedDrivers.length > 0 ? selectedDrivers : drivers;
  const driversWithPhone = driversToUse.filter(d => d.phone);

  const getExportData = (columns: string[]) => {
    const selectedCols = ALL_EXPORT_COLUMNS.filter(c => columns.includes(c.key));
    return driversToUse.map(d => {
      const row: Record<string, string> = {};
      selectedCols.forEach(col => {
        row[col.label] = col.getValue(d);
      });
      return row;
    });
  };

  const toggleColumn = (key: string) => {
    setSelectedColumns(prev => 
      prev.includes(key) 
        ? prev.filter(k => k !== key)
        : [...prev, key]
    );
  };

  const selectAllColumns = () => setSelectedColumns(DEFAULT_SELECTED_COLUMNS);
  const deselectAllColumns = () => setSelectedColumns([]);

  const generateVCard = (driversSubset: Driver[]): string => {
    const vcards = driversSubset
      .filter(d => d.phone)
      .map(d => {
        const phone = normalizePhoneToE164(d.phone);
        const telegramPhone = d.telegram_phone ? normalizePhoneToE164(d.telegram_phone) : null;
        
        let vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${d.name}\nN:${d.name};;;;\n`;
        if (phone) vcard += `TEL;TYPE=CELL:${phone}\n`;
        if (telegramPhone && telegramPhone !== phone) {
          vcard += `TEL;TYPE=CELL;PREF=0:${telegramPhone}\n`;
        }
        vcard += `END:VCARD`;
        return vcard;
      });

    return vcards.join('\n');
  };

  const downloadVcfBatch = (startIndex: number, endIndex: number) => {
    const batchDrivers = driversWithPhone.slice(startIndex, endIndex);
    const vcfContent = generateVCard(batchDrivers);
    if (!vcfContent) return;

    const date = new Date().toISOString().split('T')[0];
    const filename = `taxi-roster-contacts-${startIndex + 1}-${Math.min(endIndex, driversWithPhone.length)}-${date}.vcf`;
    
    const blob = new Blob([vcfContent], { type: 'text/vcard;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadVCF = () => {
    if (driversWithPhone.length === 0) return;

    if (driversWithPhone.length <= VCF_BATCH_SIZE) {
      downloadVcfBatch(0, driversWithPhone.length);
    } else {
      setShowVcfBatchModal(true);
    }
  };

  const openColumnSelector = (exportType: 'csv' | 'xlsx' | 'print') => {
    setPendingExportType(exportType);
    setShowColumnSelector(true);
  };

  const executeExport = () => {
    if (selectedColumns.length === 0) {
      toast.error('Please select at least one column');
      return;
    }
    
    if (pendingExportType === 'csv') {
      performCSVExport();
    } else if (pendingExportType === 'xlsx') {
      performXLSXExport();
    } else if (pendingExportType === 'print') {
      performPrint();
    }
    
    setShowColumnSelector(false);
    setPendingExportType(null);
  };

  const performCSVExport = () => {
    if (driversToUse.length === 0) return;

    const data = getExportData(selectedColumns);
    const worksheet = XLSX.utils.json_to_sheet(data);
    const csvContent = XLSX.utils.sheet_to_csv(worksheet);

    const date = new Date().toISOString().split('T')[0];
    const filename = `taxi-roster-${date}.csv`;
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`Downloaded ${driversToUse.length} records as CSV`);
  };

  const performXLSXExport = () => {
    if (driversToUse.length === 0) return;

    const data = getExportData(selectedColumns);
    const worksheet = XLSX.utils.json_to_sheet(data);
    
    // Set dynamic column widths based on selected columns
    const colWidths = selectedColumns.map(() => ({ wch: 15 }));
    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Roster');

    const date = new Date().toISOString().split('T')[0];
    const filename = `taxi-roster-${date}.xlsx`;
    
    XLSX.writeFile(workbook, filename);
    toast.success(`Downloaded ${driversToUse.length} records as Excel`);
  };

  const performPrint = () => {
    if (driversToUse.length === 0) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Unable to open print window. Please allow popups.');
      return;
    }

    const data = getExportData(selectedColumns);
    const selectedCols = ALL_EXPORT_COLUMNS.filter(c => selectedColumns.includes(c.key));
    const date = new Date().toLocaleDateString();

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Taxi Driver Roster - ${date}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              padding: 20px;
              color: #1a1a1a;
            }
            .header {
              text-align: center;
              margin-bottom: 24px;
              padding-bottom: 16px;
              border-bottom: 2px solid #e5e5e5;
            }
            .header h1 {
              font-size: 24px;
              font-weight: 700;
              margin-bottom: 4px;
            }
            .header p {
              color: #666;
              font-size: 14px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 11px;
            }
            th, td {
              border: 1px solid #ddd;
              padding: 8px 6px;
              text-align: left;
            }
            th {
              background: #f5f5f5;
              font-weight: 600;
              text-transform: uppercase;
              font-size: 10px;
              letter-spacing: 0.5px;
            }
            tr:nth-child(even) {
              background: #fafafa;
            }
            tr:hover {
              background: #f0f0f0;
            }
            .footer {
              margin-top: 24px;
              text-align: center;
              font-size: 11px;
              color: #888;
            }
            @media print {
              body { padding: 0; }
              .header { margin-bottom: 16px; }
              table { font-size: 9px; }
              th, td { padding: 4px 3px; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Taxi Driver Roster</h1>
            <p>Generated on ${date} • ${data.length} records</p>
          </div>
          <table>
            <thead>
              <tr>
                ${selectedCols.map(col => `<th>${col.label}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${data.map(row => `
                <tr>
                  ${selectedCols.map(col => `<td>${row[col.label] || ''}</td>`).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="footer">
            Taxi Driver Roster Management System
          </div>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const getVcfBatches = () => {
    const batches: { start: number; end: number; label: string }[] = [];
    const total = driversWithPhone.length;
    
    for (let i = 0; i < total; i += VCF_BATCH_SIZE) {
      const start = i;
      const end = Math.min(i + VCF_BATCH_SIZE, total);
      batches.push({
        start,
        end,
        label: `${start + 1} - ${end}`
      });
    }
    return batches;
  };

  const validCount = driversWithPhone.length;
  const totalCount = driversToUse.length;
  const label = selectedDrivers.length > 0 
    ? `${totalCount} selected` 
    : `${totalCount} records`;

  if (!isAdmin) {
    return null;
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={totalCount === 0}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              <span>Export</span>
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-popover">
            <DropdownMenuItem onClick={() => openColumnSelector('xlsx')} className="gap-2 cursor-pointer">
              <Table className="h-4 w-4" />
              Excel (.xlsx)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openColumnSelector('csv')} className="gap-2 cursor-pointer">
              <FileSpreadsheet className="h-4 w-4" />
              CSV (.csv)
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={handleDownloadVCF} 
              disabled={validCount === 0}
              className="gap-2 cursor-pointer"
            >
              <Contact className="h-4 w-4" />
              Contacts (.vcf)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openColumnSelector('print')} className="gap-2 cursor-pointer">
              <Printer className="h-4 w-4" />
              Print View
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <span className="text-xs text-muted-foreground hidden md:inline">
          ({label})
        </span>
      </div>

      <Dialog open={showVcfBatchModal} onOpenChange={setShowVcfBatchModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Download Contacts
            </DialogTitle>
            <DialogDescription>
              {driversWithPhone.length} contacts will be downloaded in batches of {VCF_BATCH_SIZE}.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 mt-4 max-h-64 overflow-y-auto">
            {getVcfBatches().map((batch, index) => (
              <Button
                key={index}
                variant="outline"
                onClick={() => downloadVcfBatch(batch.start, batch.end)}
                className="justify-start gap-2"
              >
                <Download className="h-4 w-4" />
                Contacts {batch.label}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showColumnSelector} onOpenChange={setShowColumnSelector}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              Select Columns to Export
            </DialogTitle>
            <DialogDescription>
              Choose which columns to include in your {pendingExportType === 'print' ? 'print view' : `${pendingExportType?.toUpperCase()} export`}.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-4">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={selectAllColumns}>
                Select All
              </Button>
              <Button variant="outline" size="sm" onClick={deselectAllColumns}>
                Deselect All
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
              {ALL_EXPORT_COLUMNS.map((col) => (
                <div key={col.key} className="flex items-center space-x-2">
                  <Checkbox
                    id={col.key}
                    checked={selectedColumns.includes(col.key)}
                    onCheckedChange={() => toggleColumn(col.key)}
                  />
                  <Label htmlFor={col.key} className="text-sm cursor-pointer">
                    {col.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowColumnSelector(false)}>
              Cancel
            </Button>
            <Button onClick={executeExport} disabled={selectedColumns.length === 0}>
              {pendingExportType === 'print' ? 'Print' : 'Export'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
