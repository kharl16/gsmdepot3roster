import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Link } from 'react-router-dom';
import FileUpload from '@/components/FileUpload';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Car, Home, LogOut, Upload, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';

interface DriverRow {
  badge_number: string;
  driver_name: string;
  captain: string;
  phone?: string;
  email?: string;
  license_expiry?: string;
  vehicle_number?: string;
  status?: string;
  notes?: string;
}

const Admin = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadType, setUploadType] = useState<'upsert' | 'replace'>('upsert');
  const [isUploading, setIsUploading] = useState(false);
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const parseFile = async (file: File): Promise<DriverRow[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);
          
          // Map column names (handle various formats)
          const drivers: DriverRow[] = jsonData.map((row) => {
            const getValue = (keys: string[]): string => {
              for (const key of keys) {
                const value = row[key] || row[key.toLowerCase()] || row[key.toUpperCase()];
                if (value !== undefined && value !== null) {
                  return String(value).trim();
                }
              }
              return '';
            };
            
            return {
              badge_number: getValue(['badge_number', 'badge', 'Badge Number', 'Badge #', 'Badge']),
              driver_name: getValue(['driver_name', 'name', 'Driver Name', 'Name', 'Driver']),
              captain: getValue(['captain', 'Captain', 'supervisor', 'Supervisor']),
              phone: getValue(['phone', 'Phone', 'Phone Number', 'Contact']) || undefined,
              email: getValue(['email', 'Email', 'Email Address']) || undefined,
              license_expiry: getValue(['license_expiry', 'License Expiry', 'License Exp', 'Expiry']) || undefined,
              vehicle_number: getValue(['vehicle_number', 'Vehicle Number', 'Vehicle #', 'Vehicle', 'Car Number']) || undefined,
              status: getValue(['status', 'Status']) || 'active',
              notes: getValue(['notes', 'Notes', 'Comments', 'Remarks']) || undefined,
            };
          });
          
          // Filter out rows without required fields
          const validDrivers = drivers.filter(
            (d) => d.badge_number && d.driver_name && d.captain
          );
          
          resolve(validDrivers);
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsBinaryString(file);
    });
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    
    setIsUploading(true);
    
    try {
      const drivers = await parseFile(selectedFile);
      
      if (drivers.length === 0) {
        toast({
          title: 'No valid data',
          description: 'The file contains no valid driver records. Make sure columns include badge_number, driver_name, and captain.',
          variant: 'destructive',
        });
        setIsUploading(false);
        return;
      }
      
      if (uploadType === 'replace') {
        // Delete all existing records first
        const { error: deleteError } = await supabase
          .from('taxi_roster')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
        
        if (deleteError) throw deleteError;
      }
      
      // Upsert drivers (insert or update based on badge_number)
      const { error: upsertError } = await supabase
        .from('taxi_roster')
        .upsert(drivers, { onConflict: 'badge_number' });
      
      if (upsertError) throw upsertError;
      
      // Log the upload
      await supabase.from('roster_uploads').insert({
        uploaded_by: user?.id,
        file_name: selectedFile.name,
        upload_type: uploadType,
        records_count: drivers.length,
      });
      
      // Refresh the roster data
      queryClient.invalidateQueries({ queryKey: ['taxi-roster'] });
      
      toast({
        title: 'Upload successful',
        description: `${drivers.length} driver${drivers.length !== 1 ? 's' : ''} ${uploadType === 'replace' ? 'replaced' : 'updated'} successfully.`,
      });
      
      setSelectedFile(null);
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
  };

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
                <h1 className="text-xl font-bold">Admin Panel</h1>
                <p className="text-sm text-muted-foreground">
                  Manage taxi driver roster
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button asChild variant="outline">
                <Link to="/">
                  <Home className="h-4 w-4 mr-2" />
                  View Roster
                </Link>
              </Button>
              <Button variant="ghost" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload Roster
              </CardTitle>
              <CardDescription>
                Upload a CSV or Excel file to update the driver roster.
                Required columns: badge_number, driver_name, captain
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <FileUpload onFileSelect={setSelectedFile} />
              
              {selectedFile && (
                <>
                  <div className="space-y-3">
                    <Label className="text-base font-medium">Upload Mode</Label>
                    <RadioGroup
                      value={uploadType}
                      onValueChange={(value) => setUploadType(value as 'upsert' | 'replace')}
                      className="space-y-2"
                    >
                      <div className="flex items-start space-x-3">
                        <RadioGroupItem value="upsert" id="upsert" className="mt-1" />
                        <div>
                          <Label htmlFor="upsert" className="font-medium cursor-pointer">
                            Update/Insert (Upsert)
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Add new drivers and update existing ones based on badge number
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-3">
                        <RadioGroupItem value="replace" id="replace" className="mt-1" />
                        <div>
                          <Label htmlFor="replace" className="font-medium cursor-pointer">
                            Replace All
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Delete all existing drivers and replace with uploaded data
                          </p>
                        </div>
                      </div>
                    </RadioGroup>
                  </div>
                  
                  <Button 
                    onClick={handleUpload} 
                    disabled={isUploading}
                    className="w-full"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Roster
                      </>
                    )}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Admin;
