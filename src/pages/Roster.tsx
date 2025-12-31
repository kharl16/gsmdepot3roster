import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Link } from 'react-router-dom';
import RosterTable from '@/components/RosterTable';
import RosterFilters from '@/components/RosterFilters';
import RosterExport from '@/components/RosterExport';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Car, LogIn, Settings } from 'lucide-react';
import { Driver } from '@/types/driver';

interface Filters {
  captain: string;
  schedule: string;
  restDay: string;
  status: string;
}

const Roster = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Filters>({
    captain: 'all',
    schedule: 'all',
    restDay: 'all',
    status: 'all',
  });
  const { user, isAdmin } = useAuth();

  const { data: drivers = [], isLoading, error } = useQuery({
    queryKey: ['taxi-roster'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('taxi_roster')
        .select('*')
        .order('captain', { ascending: true })
        .order('name', { ascending: true });
      
      if (error) throw error;
      return data as Driver[];
    },
  });

  // Extract unique values for filter options
  const filterOptions = useMemo(() => {
    const captains = [...new Set(drivers.map((d) => d.captain))].filter(Boolean).sort();
    const schedules = [...new Set(drivers.map((d) => d.schedule))].filter(Boolean).sort() as string[];
    const restDays = [...new Set(drivers.map((d) => d.rest_day))].filter(Boolean).sort() as string[];
    const statuses = [...new Set(drivers.map((d) => d.status))].filter(Boolean).sort() as string[];
    
    return { captains, schedules, restDays, statuses };
  }, [drivers]);

  const handleFilterChange = useCallback((key: keyof Filters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary rounded-lg">
                <Car className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Taxi Driver Roster</h1>
                <p className="text-sm text-muted-foreground">
                  {drivers.length} driver{drivers.length !== 1 ? 's' : ''} registered
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <RosterExport drivers={drivers} />
              {user && isAdmin ? (
                <Button asChild variant="outline">
                  <Link to="/admin">
                    <Settings className="h-4 w-4 mr-2" />
                    Admin Panel
                  </Link>
                </Button>
              ) : !user ? (
                <Button asChild variant="outline">
                  <Link to="/auth">
                    <LogIn className="h-4 w-4 mr-2" />
                    Admin Login
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {error ? (
          <div className="text-center py-12 text-destructive">
            Failed to load roster. Please try again later.
          </div>
        ) : isLoading ? (
          <div className="space-y-4">
            <div className="flex gap-4">
              <Skeleton className="h-10 flex-1" />
              <Skeleton className="h-10 w-[200px]" />
            </div>
            <Skeleton className="h-[400px]" />
          </div>
        ) : (
          <div className="space-y-4">
            <RosterFilters
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              filters={filters}
              onFilterChange={handleFilterChange}
              filterOptions={filterOptions}
            />
            <RosterTable
              drivers={drivers}
              searchQuery={searchQuery}
              filters={filters}
            />
          </div>
        )}
      </main>
    </div>
  );
};

export default Roster;
