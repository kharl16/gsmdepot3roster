import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Driver } from '@/types/driver';

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
          plate: data.plate,
          employee_id: data.employee_id,
          name: data.name,
          phone: data.phone || null,
          telegram_phone: data.telegram_phone || null,
          captain: data.captain,
          schedule: data.schedule || null,
          rest_day: data.rest_day || null,
          status: data.status || 'active',
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
    if (!formData.plate || !formData.employee_id || !formData.name || !formData.captain) {
      toast({
        title: 'Missing required fields',
        description: 'Plate, ID, Name, and Captain are required.',
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
              <Label htmlFor="plate">Plate *</Label>
              <Input
                id="plate"
                value={formData.plate || ''}
                onChange={(e) => setFormData({ ...formData, plate: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="employee_id">Employee ID *</Label>
              <Input
                id="employee_id"
                value={formData.employee_id || ''}
                onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                required
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
              <Label htmlFor="telegram_phone">Telegram Phone</Label>
              <Input
                id="telegram_phone"
                value={formData.telegram_phone || ''}
                onChange={(e) => setFormData({ ...formData, telegram_phone: e.target.value })}
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="schedule">Schedule</Label>
              <Input
                id="schedule"
                value={formData.schedule || ''}
                onChange={(e) => setFormData({ ...formData, schedule: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rest_day">Rest Day</Label>
              <Input
                id="rest_day"
                value={formData.rest_day || ''}
                onChange={(e) => setFormData({ ...formData, rest_day: e.target.value })}
              />
            </div>
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
