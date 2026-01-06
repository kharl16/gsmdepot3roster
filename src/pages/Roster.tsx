import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Link } from 'react-router-dom';
import RosterTable from '@/components/RosterTable';
import RosterFilters from '@/components/RosterFilters';
import RosterExport from '@/components/RosterExport';
import { RosterShareActions } from '@/components/RosterShareActions';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Car, LogIn, LogOut, Settings, Users, TrendingUp } from 'lucide-react';
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
  const [selectedDrivers, setSelectedDrivers] = useState<Driver[]>([]);
  const { user, isAdmin, signOut } = useAuth();

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

  // Extract unique values for filter options with counts
  const filterOptions = useMemo(() => {
    // Count members per captain
    const captainCounts = drivers.reduce((acc, d) => {
      if (d.captain) {
        acc[d.captain] = (acc[d.captain] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);
    
    const captains = Object.entries(captainCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, count]) => ({ name, count }));
    
    const schedules = [...new Set(drivers.map((d) => d.schedule))].filter(Boolean).sort() as string[];
    const restDays = [...new Set(drivers.map((d) => d.rest_day))].filter(Boolean).sort() as string[];
    const statuses = [...new Set(drivers.map((d) => d.status))].filter(Boolean).sort() as string[];
    
    return { captains, schedules, restDays, statuses };
  }, [drivers]);

  const handleFilterChange = useCallback((key: keyof Filters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  // Compute filtered drivers for share actions (matching table logic)
  const filteredDrivers = useMemo(() => {
    return drivers.filter((driver) => {
      if (filters.captain && filters.captain !== 'all' && driver.captain !== filters.captain) return false;
      if (filters.schedule && filters.schedule !== 'all' && driver.schedule !== filters.schedule) return false;
      if (filters.restDay && filters.restDay !== 'all' && driver.rest_day !== filters.restDay) return false;
      if (filters.status && filters.status !== 'all' && driver.status !== filters.status) return false;
      
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

  // Stats
  const activeDrivers = drivers.filter(d => d.status === 'active').length;
  const uniqueCaptains = filterOptions.captains.length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="gradient-header border-b border-border/10 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 animate-fade-in">
              <div className="p-3 gradient-primary rounded-xl shadow-glow">
                <Car className="h-7 w-7 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  Taxi Driver Roster
                </h1>
                <p className="text-sm text-white/70">
                  Fleet management dashboard
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              {user ? (
                <>
                  {isAdmin && (
                    <Button asChild variant="secondary" className="hover-lift">
                      <Link to="/admin">
                        <Settings className="h-4 w-4 mr-2" />
                        Admin
                      </Link>
                    </Button>
                  )}
                  <Button variant="outline" onClick={signOut} className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                    <LogOut className="h-4 w-4 mr-2" />
                    Logout
                  </Button>
                </>
              ) : (
                <Button asChild className="gradient-primary hover-lift shadow-glow">
                  <Link to="/auth">
                    <LogIn className="h-4 w-4 mr-2" />
                    Admin Login
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="bg-card border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="grid grid-cols-3 gap-4 animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{drivers.length}</p>
                <p className="text-xs text-muted-foreground">Total Drivers</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <div className="p-2 rounded-lg bg-success/10">
                <TrendingUp className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{activeDrivers}</p>
                <p className="text-xs text-muted-foreground">Active Drivers</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <div className="p-2 rounded-lg bg-accent/10">
                <Car className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{uniqueCaptains}</p>
                <p className="text-xs text-muted-foreground">Team Captains</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {error ? (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-destructive/10 mb-4">
              <Car className="h-8 w-8 text-destructive" />
            </div>
            <p className="text-destructive font-medium">Failed to load roster</p>
            <p className="text-sm text-muted-foreground mt-1">Please try again later</p>
          </div>
        ) : isLoading ? (
          <div className="space-y-4 animate-pulse">
            <div className="flex gap-4">
              <Skeleton className="h-10 flex-1" />
              <Skeleton className="h-10 w-[200px]" />
            </div>
            <Skeleton className="h-[500px] rounded-xl" />
          </div>
        ) : (
          <div className="space-y-4 animate-fade-in" style={{ animationDelay: '0.2s' }}>
            {/* Filters Card */}
            <div className="bg-card rounded-xl border shadow-sm p-4">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <RosterFilters
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  filters={filters}
                  onFilterChange={handleFilterChange}
                  filterOptions={filterOptions}
                />
                <RosterShareActions 
                  drivers={filteredDrivers} 
                  selectedDrivers={selectedDrivers}
                />
              </div>
            </div>
            
            {/* Table Card */}
            <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
              <RosterTable
                drivers={drivers}
                searchQuery={searchQuery}
                filters={filters}
                onSelectionChange={setSelectedDrivers}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Roster;