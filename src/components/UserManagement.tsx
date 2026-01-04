import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { useToast } from '@/hooks/use-toast';
import { Users, UserPlus, Trash2, Loader2, Mail, Lock, KeyRound } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface AdminUser {
  id: string;
  user_id: string;
  role: string;
  email: string | null;
}

const UserManagement = () => {
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [createIfNotExists, setCreateIfNotExists] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [resetPasswordEmail, setResetPasswordEmail] = useState('');
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch admin users with their emails from profiles
  const { data: adminUsers = [], isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      // Get all admin roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*')
        .eq('role', 'admin');

      if (rolesError) throw rolesError;

      // Get profiles for these users
      const userIds = (roles || []).map(r => r.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      // Map roles with emails
      const usersWithEmails: AdminUser[] = (roles || []).map(role => {
        const profile = profiles?.find(p => p.id === role.user_id);
        return {
          id: role.id,
          user_id: role.user_id,
          role: role.role,
          email: profile?.email || null,
        };
      });

      return usersWithEmails;
    },
  });

  // Add admin mutation using edge function
  const addAdminMutation = useMutation({
    mutationFn: async ({ email, password, createIfNotExists }: { email: string; password?: string; createIfNotExists: boolean }) => {
      if (!email || !email.includes('@')) {
        throw new Error('Please enter a valid email address');
      }

      if (createIfNotExists && (!password || password.length < 6)) {
        throw new Error('Password must be at least 6 characters when creating a new user');
      }

      const { data, error } = await supabase.functions.invoke('manage-admin', {
        body: { action: 'add', email, password: createIfNotExists ? password : undefined, createIfNotExists },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setNewAdminEmail('');
      setNewAdminPassword('');
      setCreateIfNotExists(false);
      toast({
        title: 'Admin added',
        description: 'The user has been granted admin access.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Failed to add admin',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    },
  });

  // Remove admin mutation
  const removeAdminMutation = useMutation({
    mutationFn: async (roleId: string) => {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('id', roleId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast({
        title: 'Admin removed',
        description: 'Admin access has been revoked.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Failed to remove admin',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    },
  });

  // Reset password mutation
  const resetPasswordMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      if (!email || !email.includes('@')) {
        throw new Error('Please enter a valid email address');
      }

      if (password.length < 6) {
        throw new Error('Password must be at least 6 characters');
      }

      const { data, error } = await supabase.functions.invoke('manage-admin', {
        body: { action: 'reset-password', email, password },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      return data;
    },
    onSuccess: () => {
      setResetPasswordEmail('');
      setResetPasswordValue('');
      toast({
        title: 'Password reset',
        description: 'The user password has been updated successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Failed to reset password',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    },
  });

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminEmail.trim()) return;
    
    setIsAdding(true);
    try {
      await addAdminMutation.mutateAsync({ 
        email: newAdminEmail.trim(), 
        password: newAdminPassword, 
        createIfNotExists 
      });
    } finally {
      setIsAdding(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordEmail.trim() || !resetPasswordValue.trim()) return;
    
    setIsResetting(true);
    try {
      await resetPasswordMutation.mutateAsync({ 
        email: resetPasswordEmail.trim(), 
        password: resetPasswordValue 
      });
    } finally {
      setIsResetting(false);
    }
  };

  const handleRemoveAdmin = (roleId: string, userId: string) => {
    // Prevent removing yourself
    if (userId === user?.id) {
      toast({
        title: 'Cannot remove yourself',
        description: 'You cannot remove your own admin access.',
        variant: 'destructive',
      });
      return;
    }
    removeAdminMutation.mutate(roleId);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          User Management
        </CardTitle>
        <CardDescription>
          View and manage admin users who can access the admin panel.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add Admin Form */}
        <form onSubmit={handleAddAdmin} className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="email"
                placeholder="Enter email to add as admin..."
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button type="submit" disabled={isAdding || !newAdminEmail.trim() || (createIfNotExists && newAdminPassword.length < 6)}>
              {isAdding ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add Admin
                </>
              )}
            </Button>
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="createIfNotExists" 
              checked={createIfNotExists}
              onCheckedChange={(checked) => setCreateIfNotExists(checked === true)}
            />
            <Label htmlFor="createIfNotExists" className="text-sm cursor-pointer">
              Create user account if not exists
            </Label>
          </div>
          
          {createIfNotExists && (
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="password"
                placeholder="Password for new user (min 6 characters)"
                value={newAdminPassword}
                onChange={(e) => setNewAdminPassword(e.target.value)}
                className="pl-9"
              />
            </div>
          )}
        </form>

        {/* Reset Password Form */}
        <form onSubmit={handleResetPassword} className="space-y-4 border-t pt-6">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            Reset User Password
          </h4>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="email"
                placeholder="User email address"
                value={resetPasswordEmail}
                onChange={(e) => setResetPasswordEmail(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="password"
                placeholder="New password (min 6 characters)"
                value={resetPasswordValue}
                onChange={(e) => setResetPasswordValue(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button 
              type="submit" 
              variant="secondary"
              disabled={isResetting || !resetPasswordEmail.trim() || resetPasswordValue.length < 6}
            >
              {isResetting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <KeyRound className="h-4 w-4 mr-2" />
                  Reset Password
                </>
              )}
            </Button>
          </div>
        </form>

        {/* Admin Users Table */}
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : adminUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                    No admin users found
                  </TableCell>
                </TableRow>
              ) : (
                adminUsers.map((adminUser) => (
                  <TableRow key={adminUser.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {adminUser.email || <span className="text-muted-foreground italic">No email</span>}
                        </span>
                        {adminUser.user_id === user?.id && (
                          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                            You
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary capitalize">
                        {adminUser.role}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            disabled={adminUser.user_id === user?.id}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove Admin Access</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to remove admin access for {adminUser.email || 'this user'}? 
                              They will no longer be able to access the admin panel.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleRemoveAdmin(adminUser.id, adminUser.user_id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Remove Access
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <p className="text-xs text-muted-foreground">
          Enter an email address of a registered user to grant them admin access.
        </p>
      </CardContent>
    </Card>
  );
};

export default UserManagement;
