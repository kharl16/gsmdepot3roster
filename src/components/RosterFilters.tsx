import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search } from 'lucide-react';

interface RosterFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  captainFilter: string;
  onCaptainChange: (value: string) => void;
  captains: string[];
}

const RosterFilters = ({
  searchQuery,
  onSearchChange,
  captainFilter,
  onCaptainChange,
  captains,
}: RosterFiltersProps) => {
  return (
    <div className="flex flex-col sm:flex-row gap-4">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, badge, phone, email..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>
      <Select value={captainFilter} onValueChange={onCaptainChange}>
        <SelectTrigger className="w-full sm:w-[200px]">
          <SelectValue placeholder="All Captains" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Captains</SelectItem>
          {captains.map((captain) => (
            <SelectItem key={captain} value={captain}>
              {captain}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default RosterFilters;
