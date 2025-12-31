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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Car, Home, LogOut, Upload, Loader2, Eye } from 'lucide-react';
import * as XLSX from 'xlsx';

interface DriverRow {
  plate: string;
  employee_id: string;
  name: string;
  captain: string;
  phone?: string;
  telegram_phone?: string;
  schedule?: string;
  rest_day?: string;
  status?: string;
}

const Admin = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadType, setUploadType] = useState<'upsert' | 'replace'>('upsert');
  const [isUploading, setIsUploading] = useState(false);
  const [previewData, setPreviewData] = useState<DriverRow[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const normalizeHeader = (header: string): string => {
    // Trim and lowercase
    let normalized = header.trim().toLowerCase();
    
    // Handle common variations
    const mappings: Record<string, string> = {
      'plate': 'plate',
      'plate #': 'plate',
      'plate#': 'plate',
      'id': 'employee_id',
      'employee id': 'employee_id',
      'employee_id': 'employee_id',
      'name': 'name',
      'driver name': 'name',
      'driver_name': 'name',
      'phone': 'phone',
      'phone #': 'phone',
      'phone#': 'phone',
      'phone number': 'phone',
      'telegram': 'telegram_phone',
      'telegram phone': 'telegram_phone',
      'telegram_phone': 'telegram_phone',
      'captain': 'captain',
      'supervisor': 'captain',
      'schedule': 'schedule',
      'schedule ': 'schedule', // Handle trailing space
      'rd': 'rest_day',
      'rd (rest day)': 'rest_day',
      'rest day': 'rest_day',
      'rest_day': 'rest_day',
      'restday': 'rest_day',
      'status': 'status',
    };
    
    return mappings[normalized] || normalized;
  };

  const parseFile = async (file: File): Promise<DriverRow[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { raw: false });
          
          // Map column names with normalization
          const drivers: DriverRow[] = jsonData.map((row) => {
            // Create a normalized key map
            const normalizedRow: Record<string, string> = {};
            for (const [key, value] of Object.entries(row)) {
              const normalizedKey = normalizeHeader(key);
              normalizedRow[normalizedKey] = value !== undefined && value !== null ? String(value).trim() : '';
            }
            
            return {
              plate: normalizedRow['plate'] || '',
              employee_id: normalizedRow['employee_id'] || '',
              name: normalizedRow['name'] || '',
              captain: normalizedRow['captain'] || '',
              phone: normalizedRow['phone'] || undefined,
              telegram_phone: normalizedRow['telegram_phone'] || undefined,
              schedule: normalizedRow['schedule'] || undefined,
              rest_day: normalizedRow['rest_day'] || undefined,
              status: normalizedRow['status'] || 'active',
            };
          });
          
          // Filter out rows without required fields
          const validDrivers = drivers.filter(
            (d) => d.plate && d.employee_id && d.name && d.captain
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

  const handleFileSelect = async (file: File | null) => {
    setSelectedFile(file);
    setShowPreview(false);
    setPreviewData([]);
    
    if (file) {
      try {
        const data = await parseFile(file);
        setPreviewData(data.slice(0, 20)); // Preview first 20 rows
        setShowPreview(true);
      } catch (error) {
        console.error('Preview error:', error);
        toast({
          title: 'Preview failed',
          description: 'Could not parse file for preview.',
          variant: 'destructive',
        });
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    
    setIsUploading(true);
    
    try {
      const drivers = await parseFile(selectedFile);
      
      if (drivers.length === 0) {
        toast({
          title: 'No valid data',
          description: 'The file contains no valid driver records. Required columns: PLATE, ID, NAME, Captain.',
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
      
      // Upsert drivers (insert or update based on plate)
      const { error: upsertError } = await supabase
        .from('taxi_roster')
        .upsert(drivers, { onConflict: 'plate' });
      
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
      setPreviewData([]);
      setShowPreview(false);
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
        <div className="max-w-4xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload Roster
              </CardTitle>
              <CardDescription>
                Upload a CSV or Excel file to update the driver roster.
                Required columns: PLATE, ID, NAME, Captain
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <FileUpload onFileSelect={handleFileSelect} />
              
              {showPreview && previewData.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Eye className="h-4 w-4" />
                    Preview (first 20 rows of {previewData.length} parsed)
                  </div>
                  <div className="border rounded-md overflow-x-auto max-h-[300px]">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead>PLATE</TableHead>
                          <TableHead>ID</TableHead>
                          <TableHead>NAME</TableHead>
                          <TableHead>Captain</TableHead>
                          <TableHead>Schedule</TableHead>
                          <TableHead>RD</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewData.map((row, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-mono">{row.plate}</TableCell>
                            <TableCell>{row.employee_id}</TableCell>
                            <TableCell>{row.name}</TableCell>
                            <TableCell>{row.captain}</TableCell>
                            <TableCell>{row.schedule || '-'}</TableCell>
                            <TableCell>{row.rest_day || '-'}</TableCell>
                            <TableCell>{row.status || 'active'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
              
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
                            Update/Insert (Upsert by PLATE)
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Add new drivers and update existing ones based on plate number
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
