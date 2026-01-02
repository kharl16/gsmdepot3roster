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
import { Users, UserPlus, Trash2, Loader2, Mail } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface AdminUser {
  id: string;
  user_id: string;
  role: string;
  email: string;
}

const UserManagement = () => {
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch admin users
  const { data: adminUsers = [], isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      // First get all user roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*')
        .eq('role', 'admin');

      if (rolesError) throw rolesError;

      // Then fetch user emails from a custom RPC or by querying auth users
      // Since we can't directly query auth.users, we'll use a workaround
      // by displaying user_id and letting admins know the email
      const usersWithEmails: AdminUser[] = [];
      
      for (const role of roles || []) {
        // We'll try to get user info - this requires the user to be the same
        // For now, we'll display what we have
        usersWithEmails.push({
          id: role.id,
          user_id: role.user_id,
          role: role.role,
          email: role.user_id, // Placeholder - will be replaced if we can get email
        });
      }

      return usersWithEmails;
    },
  });

  // Add admin mutation
  const addAdminMutation = useMutation({
    mutationFn: async (email: string) => {
      // First, we need to find the user by email
      // This is typically done via an edge function or admin API
      // For now, we'll show an error if the user doesn't exist
      
      // Check if email is valid
      if (!email || !email.includes('@')) {
        throw new Error('Please enter a valid email address');
      }

      // Since we can't query auth.users directly from client, 
      // we'll inform the user about the limitation
      throw new Error('To add a new admin, please contact the system administrator or use the database directly to add the user_id to user_roles table.');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setNewAdminEmail('');
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

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminEmail.trim()) return;
    
    setIsAdding(true);
    try {
      await addAdminMutation.mutateAsync(newAdminEmail.trim());
    } finally {
      setIsAdding(false);
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
        <form onSubmit={handleAddAdmin} className="flex gap-2">
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
          <Button type="submit" disabled={isAdding || !newAdminEmail.trim()}>
            {isAdding ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <UserPlus className="h-4 w-4 mr-2" />
                Add Admin
              </>
            )}
          </Button>
        </form>

        {/* Admin Users Table */}
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>User ID</TableHead>
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
                    <TableCell className="font-mono text-sm">
                      {adminUser.user_id}
                      {adminUser.user_id === user?.id && (
                        <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                          You
                        </span>
                      )}
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
                              Are you sure you want to remove admin access for this user? 
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
          Note: To add new admins, users must first create an account. Then their user ID can be added to the admin list.
        </p>
      </CardContent>
    </Card>
  );
};

export default UserManagement;
