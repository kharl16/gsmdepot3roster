import { useState, useMemo } from 'react';
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
import { format } from 'date-fns';
import { Pencil, Trash2, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import EditDriverDialog from '@/components/EditDriverDialog';

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

interface RosterTableProps {
  drivers: Driver[];
  searchQuery: string;
  captainFilter: string;
}

type SortKey = 'badge_number' | 'driver_name' | 'captain' | 'phone' | 'email' | 'vehicle_number' | 'license_expiry' | 'status';
type SortDirection = 'asc' | 'desc' | null;

const RosterTable = ({ drivers, searchQuery, captainFilter }: RosterTableProps) => {
  const { isAdmin } = useAuth();
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const { error } = await supabase.from('taxi_roster').delete().eq('id', id);
    setDeletingId(null);
    
    if (error) {
      toast.error('Failed to delete driver');
    } else {
      toast.success('Driver deleted successfully');
      window.location.reload();
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
      window.location.reload();
    }
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredDrivers.map(d => d.id)));
    } else {
      setSelectedIds(new Set());
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
  };

  const handleSort = (key: SortKey) => {
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

  const getSortIcon = (key: SortKey) => {
    if (sortKey !== key) return <ArrowUpDown className="ml-1 h-3 w-3" />;
    if (sortDirection === 'asc') return <ArrowUp className="ml-1 h-3 w-3" />;
    return <ArrowDown className="ml-1 h-3 w-3" />;
  };

  const filteredDrivers = useMemo(() => {
    return drivers.filter((driver) => {
      if (captainFilter && driver.captain !== captainFilter) {
        return false;
      }
      
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          driver.badge_number.toLowerCase().includes(query) ||
          driver.driver_name.toLowerCase().includes(query) ||
          driver.captain.toLowerCase().includes(query) ||
          driver.phone?.toLowerCase().includes(query) ||
          driver.email?.toLowerCase().includes(query) ||
          driver.vehicle_number?.toLowerCase().includes(query) ||
          driver.notes?.toLowerCase().includes(query)
        );
      }
      
      return true;
    });
  }, [drivers, searchQuery, captainFilter]);

  const sortedDrivers = useMemo(() => {
    if (!sortKey || !sortDirection) return filteredDrivers;
    
    return [...filteredDrivers].sort((a, b) => {
      const aVal = a[sortKey] ?? '';
      const bVal = b[sortKey] ?? '';
      
      const comparison = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
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
        return <Badge variant="outline">{status || 'Unknown'}</Badge>;
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    try {
      return format(new Date(dateString), 'MMM dd, yyyy');
    } catch {
      return dateString;
    }
  };

  const SortableHeader = ({ sortKeyName, children }: { sortKeyName: SortKey; children: React.ReactNode }) => (
    <Button
      variant="ghost"
      className="h-auto p-0 font-semibold hover:bg-transparent"
      onClick={() => handleSort(sortKeyName)}
    >
      {children}
      {getSortIcon(sortKeyName)}
    </Button>
  );

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
  const someSelected = selectedIds.size > 0;

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
      <div className="rounded-md border">
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
              <TableHead><SortableHeader sortKeyName="badge_number">Badge #</SortableHeader></TableHead>
              <TableHead><SortableHeader sortKeyName="driver_name">Driver Name</SortableHeader></TableHead>
              <TableHead><SortableHeader sortKeyName="captain">Captain</SortableHeader></TableHead>
              <TableHead><SortableHeader sortKeyName="phone">Phone</SortableHeader></TableHead>
              <TableHead><SortableHeader sortKeyName="email">Email</SortableHeader></TableHead>
              <TableHead><SortableHeader sortKeyName="vehicle_number">Vehicle #</SortableHeader></TableHead>
              <TableHead><SortableHeader sortKeyName="license_expiry">License Expiry</SortableHeader></TableHead>
              <TableHead><SortableHeader sortKeyName="status">Status</SortableHeader></TableHead>
              <TableHead className="font-semibold">Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedDrivers.map((driver) => (
              <TableRow key={driver.id} className={`hover:bg-muted/30 ${selectedIds.has(driver.id) ? 'bg-muted/20' : ''}`}>
                {isAdmin && (
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(driver.id)}
                      onCheckedChange={(checked) => toggleSelect(driver.id, !!checked)}
                      aria-label={`Select ${driver.driver_name}`}
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
                              Are you sure you want to delete {driver.driver_name}? This action cannot be undone.
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
                <TableCell className="font-mono font-medium">{driver.badge_number}</TableCell>
                <TableCell className="font-medium">{driver.driver_name}</TableCell>
                <TableCell>{driver.captain}</TableCell>
                <TableCell className="text-muted-foreground">{driver.phone || '-'}</TableCell>
                <TableCell className="text-muted-foreground">{driver.email || '-'}</TableCell>
                <TableCell className="font-mono">{driver.vehicle_number || '-'}</TableCell>
                <TableCell>{formatDate(driver.license_expiry)}</TableCell>
                <TableCell>{getStatusBadge(driver.status)}</TableCell>
                <TableCell className="max-w-[200px] truncate text-muted-foreground">
                  {driver.notes || '-'}
                </TableCell>
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
