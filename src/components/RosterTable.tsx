import { useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

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

const RosterTable = ({ drivers, searchQuery, captainFilter }: RosterTableProps) => {
  const filteredDrivers = useMemo(() => {
    return drivers.filter((driver) => {
      // Captain filter
      if (captainFilter && driver.captain !== captainFilter) {
        return false;
      }
      
      // Global search
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

  if (filteredDrivers.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        {drivers.length === 0 
          ? 'No drivers in the roster yet.' 
          : 'No drivers match your search criteria.'}
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="font-semibold">Badge #</TableHead>
            <TableHead className="font-semibold">Driver Name</TableHead>
            <TableHead className="font-semibold">Captain</TableHead>
            <TableHead className="font-semibold">Phone</TableHead>
            <TableHead className="font-semibold">Email</TableHead>
            <TableHead className="font-semibold">Vehicle #</TableHead>
            <TableHead className="font-semibold">License Expiry</TableHead>
            <TableHead className="font-semibold">Status</TableHead>
            <TableHead className="font-semibold">Notes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredDrivers.map((driver) => (
            <TableRow key={driver.id} className="hover:bg-muted/30">
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
  );
};

export default RosterTable;
