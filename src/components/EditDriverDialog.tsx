import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

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

interface EditDriverDialogProps {
  driver: Driver | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EditDriverDialog = ({ driver, open, onOpenChange }: EditDriverDialogProps) => {
  const [formData, setFormData] = useState<Partial<Driver>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (driver) {
      setFormData(driver);
    }
  }, [driver]);

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<Driver>) => {
      const { error } = await supabase
        .from('taxi_roster')
        .update({
          badge_number: data.badge_number,
          driver_name: data.driver_name,
          captain: data.captain,
          phone: data.phone || null,
          email: data.email || null,
          license_expiry: data.license_expiry || null,
          vehicle_number: data.vehicle_number || null,
          status: data.status || 'active',
          notes: data.notes || null,
        })
        .eq('id', data.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taxi-roster'] });
      toast({ title: 'Driver updated successfully' });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Update failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.badge_number || !formData.driver_name || !formData.captain) {
      toast({
        title: 'Missing required fields',
        description: 'Badge number, driver name, and captain are required.',
        variant: 'destructive',
      });
      return;
    }
    updateMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Driver</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="badge_number">Badge Number *</Label>
              <Input
                id="badge_number"
                value={formData.badge_number || ''}
                onChange={(e) => setFormData({ ...formData, badge_number: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vehicle_number">Vehicle Number</Label>
              <Input
                id="vehicle_number"
                value={formData.vehicle_number || ''}
                onChange={(e) => setFormData({ ...formData, vehicle_number: e.target.value })}
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="driver_name">Driver Name *</Label>
            <Input
              id="driver_name"
              value={formData.driver_name || ''}
              onChange={(e) => setFormData({ ...formData, driver_name: e.target.value })}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="captain">Captain *</Label>
            <Input
              id="captain"
              value={formData.captain || ''}
              onChange={(e) => setFormData({ ...formData, captain: e.target.value })}
              required
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone || ''}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="license_expiry">License Expiry</Label>
              <Input
                id="license_expiry"
                type="date"
                value={formData.license_expiry || ''}
                onChange={(e) => setFormData({ ...formData, license_expiry: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status || 'active'}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
            />
          </div>
          
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditDriverDialog;