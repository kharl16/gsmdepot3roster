import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search } from 'lucide-react';

interface CaptainOption {
  name: string;
  count: number;
}

interface FilterOptions {
  captains: CaptainOption[];
  schedules: string[];
  restDays: string[];
  statuses: string[];
}

interface Filters {
  captain: string;
  schedule: string;
  restDay: string;
  status: string;
}

interface RosterFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  filters: Filters;
  onFilterChange: (key: keyof Filters, value: string) => void;
  filterOptions: FilterOptions;
}

const RosterFilters = ({
  searchQuery,
  onSearchChange,
  filters,
  onFilterChange,
  filterOptions,
}: RosterFiltersProps) => {
  return (
    <div className="flex flex-col sm:flex-row gap-3 flex-1">
      {/* Search */}
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search drivers..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 bg-muted/50 border-0 focus-visible:ring-primary"
        />
      </div>
      
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {/* Captain Filter */}
        <Select 
          value={filters.captain} 
          onValueChange={(value) => onFilterChange('captain', value)}
        >
          <SelectTrigger className="w-[180px] bg-muted/50 border-0">
            <SelectValue placeholder="All Captains" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Captains</SelectItem>
            {filterOptions.captains.map((captain) => (
              <SelectItem key={captain.name} value={captain.name}>
                {captain.name} ({captain.count})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Schedule Filter */}
        <Select 
          value={filters.schedule} 
          onValueChange={(value) => onFilterChange('schedule', value)}
        >
          <SelectTrigger className="w-[150px] bg-muted/50 border-0">
            <SelectValue placeholder="All Schedules" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Schedules</SelectItem>
            {filterOptions.schedules.map((schedule) => (
              <SelectItem key={schedule} value={schedule}>
                {schedule}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Rest Day Filter */}
        <Select 
          value={filters.restDay} 
          onValueChange={(value) => onFilterChange('restDay', value)}
        >
          <SelectTrigger className="w-[130px] bg-muted/50 border-0">
            <SelectValue placeholder="All RDs" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All RDs</SelectItem>
            {filterOptions.restDays.map((rd) => (
              <SelectItem key={rd} value={rd}>
                {rd}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status Filter */}
        <Select 
          value={filters.status} 
          onValueChange={(value) => onFilterChange('status', value)}
        >
          <SelectTrigger className="w-[130px] bg-muted/50 border-0">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {filterOptions.statuses.map((status) => (
              <SelectItem key={status} value={status}>
                {status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

export default RosterFilters;