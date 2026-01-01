import { useState, useMemo, useRef } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Pencil, Trash2, ArrowUpDown, ArrowUp, ArrowDown, Phone, MessageCircle, GripVertical } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import EditDriverDialog from '@/components/EditDriverDialog';
import { Driver, ColumnKey, ColumnDef } from '@/types/driver';
import { getTelLink, getTelegramLink, formatPhoneForDisplay, maskPhoneNumber } from '@/lib/phone-utils';
import { useColumnOrder } from '@/hooks/useColumnOrder';

interface Filters {
  captain: string;
  schedule: string;
  restDay: string;
  status: string;
}

interface RosterTableProps {
  drivers: Driver[];
  searchQuery: string;
  filters: Filters;
  onSelectionChange?: (selectedDrivers: Driver[]) => void;
}

type SortDirection = 'asc' | 'desc' | null;

const RosterTable = ({ drivers, searchQuery, filters, onSelectionChange }: RosterTableProps) => {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [sortKey, setSortKey] = useState<ColumnKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const { columns, moveColumn } = useColumnOrder();
  
  // Drag state
  const draggedColumn = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const { error } = await supabase.from('taxi_roster').delete().eq('id', id);
    setDeletingId(null);
    
    if (error) {
      toast.error('Failed to delete driver');
    } else {
      toast.success('Driver deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['taxi-roster'] });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    
    setIsBulkDeleting(true);
    const { error } = await supabase
      .from('taxi_roster')
      .delete()
      .in('id', Array.from(selectedIds));
    setIsBulkDeleting(false);
    
    if (error) {
      toast.error('Failed to delete drivers');
    } else {
      toast.success(`${selectedIds.size} driver(s) deleted successfully`);
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ['taxi-roster'] });
    }
  };

  const toggleSelectAll = (checked: boolean) => {
    const newIds = checked ? new Set(filteredDrivers.map(d => d.id)) : new Set<string>();
    setSelectedIds(newIds);
    if (onSelectionChange) {
      const selected = checked ? filteredDrivers : [];
      onSelectionChange(selected);
    }
  };

  const toggleSelect = (id: string, checked: boolean) => {
    const newSet = new Set(selectedIds);
    if (checked) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    setSelectedIds(newSet);
    if (onSelectionChange) {
      const selected = filteredDrivers.filter(d => newSet.has(d.id));
      onSelectionChange(selected);
    }
  };

  const handleSort = (key: ColumnKey) => {
    if (sortKey === key) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortKey(null);
        setSortDirection(null);
      }
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (key: ColumnKey) => {
    if (sortKey !== key) return <ArrowUpDown className="ml-1 h-3 w-3" />;
    if (sortDirection === 'asc') return <ArrowUp className="ml-1 h-3 w-3" />;
    return <ArrowDown className="ml-1 h-3 w-3" />;
  };

  // Handle drag events
  const handleDragStart = (index: number) => {
    draggedColumn.current = index;
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDragEnd = () => {
    if (draggedColumn.current !== null && dragOverIndex !== null && draggedColumn.current !== dragOverIndex) {
      moveColumn(draggedColumn.current, dragOverIndex);
    }
    draggedColumn.current = null;
    setDragOverIndex(null);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  // Filter drivers
  const filteredDrivers = useMemo(() => {
    return drivers.filter((driver) => {
      // Apply filters (AND logic)
      if (filters.captain && filters.captain !== 'all' && driver.captain !== filters.captain) {
        return false;
      }
      if (filters.schedule && filters.schedule !== 'all' && driver.schedule !== filters.schedule) {
        return false;
      }
      if (filters.restDay && filters.restDay !== 'all' && driver.rest_day !== filters.restDay) {
        return false;
      }
      if (filters.status && filters.status !== 'all' && driver.status !== filters.status) {
        return false;
      }
      
      // Apply search (partial, case-insensitive, across all columns)
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          driver.plate.toLowerCase().includes(query) ||
          driver.employee_id.toLowerCase().includes(query) ||
          driver.name.toLowerCase().includes(query) ||
          driver.phone?.toLowerCase().includes(query) ||
          driver.telegram_phone?.toLowerCase().includes(query) ||
          driver.captain.toLowerCase().includes(query) ||
          driver.schedule?.toLowerCase().includes(query) ||
          driver.rest_day?.toLowerCase().includes(query) ||
          driver.status?.toLowerCase().includes(query)
        );
      }
      
      return true;
    });
  }, [drivers, searchQuery, filters]);

  // Sort drivers
  const sortedDrivers = useMemo(() => {
    if (!sortKey || !sortDirection) return filteredDrivers;
    
    return [...filteredDrivers].sort((a, b) => {
      let aVal: string | null = null;
      let bVal: string | null = null;
      
      switch (sortKey) {
        case 'plate': aVal = a.plate; bVal = b.plate; break;
        case 'employee_id': aVal = a.employee_id; bVal = b.employee_id; break;
        case 'name': aVal = a.name; bVal = b.name; break;
        case 'captain': aVal = a.captain; bVal = b.captain; break;
        case 'schedule': aVal = a.schedule; bVal = b.schedule; break;
        case 'rest_day': aVal = a.rest_day; bVal = b.rest_day; break;
        case 'status': aVal = a.status; bVal = b.status; break;
        default: return 0;
      }
      
      const comparison = String(aVal ?? '').localeCompare(String(bVal ?? ''), undefined, { numeric: true });
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredDrivers, sortKey, sortDirection]);

  const getStatusBadge = (status: string | null) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/20">Active</Badge>;
      case 'inactive':
        return <Badge variant="secondary">Inactive</Badge>;
      case 'suspended':
        return <Badge variant="destructive">Suspended</Badge>;
      default:
        return <Badge variant="outline">{status || '-'}</Badge>;
    }
  };

  const renderCellContent = (driver: Driver, columnKey: ColumnKey) => {
    switch (columnKey) {
      case 'plate':
        return <span className="font-mono font-medium">{driver.plate}</span>;
      case 'employee_id':
        return <span className="font-mono">{driver.employee_id}</span>;
      case 'name':
        return <span className="font-medium">{driver.name}</span>;
      case 'phone': {
        if (!driver.phone) return <span className="text-muted-foreground">-</span>;
        
        // Non-admin users see masked phone numbers (no clickable link)
        if (!isAdmin) {
          return (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Phone className="h-3 w-3" />
              <span className="font-mono">{maskPhoneNumber(driver.phone)}</span>
            </span>
          );
        }
        
        const telLink = getTelLink(driver.phone);
        return (
          <a 
            href={telLink || '#'} 
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            <Phone className="h-3 w-3" />
            <span className="hidden sm:inline">{formatPhoneForDisplay(driver.phone)}</span>
            <span className="sm:hidden">Call</span>
          </a>
        );
      }
      case 'telegram': {
        // Non-admin users cannot access Telegram links
        if (!isAdmin) {
          const hasPhone = driver.telegram_phone || driver.phone;
          if (!hasPhone) return <span className="text-muted-foreground">-</span>;
          return (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <MessageCircle className="h-3 w-3" />
              <span className="font-mono">{maskPhoneNumber(driver.telegram_phone || driver.phone)}</span>
            </span>
          );
        }
        
        const telegramLink = getTelegramLink(driver.telegram_phone, driver.phone);
        if (!telegramLink) return <span className="text-muted-foreground">-</span>;
        return (
          <a 
            href={telegramLink} 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-blue-500 hover:underline"
          >
            <MessageCircle className="h-3 w-3" />
            <span>Telegram</span>
          </a>
        );
      }
      case 'captain':
        return driver.captain;
      case 'schedule':
        return driver.schedule || '-';
      case 'rest_day':
        return driver.rest_day || '-';
      case 'status':
        return getStatusBadge(driver.status);
      default:
        return '-';
    }
  };

  if (filteredDrivers.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        {drivers.length === 0 
          ? 'No drivers in the roster yet.' 
          : 'No drivers match your search criteria.'}
      </div>
    );
  }

  const allSelected = sortedDrivers.length > 0 && sortedDrivers.every(d => selectedIds.has(d.id));

  return (
    <>
      {isAdmin && selectedIds.size > 0 && (
        <div className="mb-4 flex items-center gap-4 p-3 bg-muted/50 rounded-lg border">
          <span className="text-sm font-medium">{selectedIds.size} driver(s) selected</span>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={isBulkDeleting}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Selected
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {selectedIds.size} Driver(s)</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete {selectedIds.size} driver(s)? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleBulkDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete All
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set())}>
            Clear Selection
          </Button>
        </div>
      )}
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              {isAdmin && (
                <TableHead className="w-[50px]">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(checked) => toggleSelectAll(!!checked)}
                    aria-label="Select all"
                  />
                </TableHead>
              )}
              {isAdmin && <TableHead className="w-[80px]"></TableHead>}
              {columns.map((col, index) => (
                <TableHead 
                  key={col.key}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  onDragLeave={handleDragLeave}
                  className={`cursor-grab select-none ${dragOverIndex === index ? 'bg-primary/20' : ''}`}
                >
                  <div className="flex items-center gap-1">
                    <GripVertical className="h-3 w-3 text-muted-foreground" />
                    {col.sortable ? (
                      <Button
                        variant="ghost"
                        className="h-auto p-0 font-semibold hover:bg-transparent"
                        onClick={() => handleSort(col.key)}
                      >
                        {col.label}
                        {getSortIcon(col.key)}
                      </Button>
                    ) : (
                      <span className="font-semibold">{col.label}</span>
                    )}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedDrivers.map((driver) => (
              <TableRow 
                key={driver.id} 
                className={`hover:bg-muted/30 ${selectedIds.has(driver.id) ? 'bg-muted/20' : ''}`}
              >
                {isAdmin && (
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(driver.id)}
                      onCheckedChange={(checked) => toggleSelect(driver.id, !!checked)}
                      aria-label={`Select ${driver.name}`}
                    />
                  </TableCell>
                )}
                {isAdmin && (
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditingDriver(driver)}
                        className="h-8 w-8"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            disabled={deletingId === driver.id}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Driver</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete {driver.name}? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(driver.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                )}
                {columns.map((col) => (
                  <TableCell key={col.key}>
                    {renderCellContent(driver, col.key)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <EditDriverDialog
        driver={editingDriver}
        open={!!editingDriver}
        onOpenChange={(open) => !open && setEditingDriver(null)}
      />
    </>
  );
};

export default RosterTable;
