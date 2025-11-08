import { useState, useRef, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Users, 
  UserPlus, 
  Upload, 
  Trash2,
  LayoutDashboard,
  Settings,
} from 'lucide-react';
import { UserRole } from '@/types/auth';
import { getCurrentUser, removeUser, getAllUsers, addUser } from '@/lib/auth';

/**
 * Admin Dashboard Component
 * Manages users with add/remove functionality and bulk CSV upload
 * Features: user table with real-time updates, form validation, confirmation dialogs
 */
interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  department?: string;
}

const AdminDashboard = () => {
  const [activeSection, setActiveSection] = useState('users');
  const [users, setUsers] = useState<Profile[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state for adding new user
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'student' as UserRole,
    department: '',
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const sidebarItems = [
    {
      icon: <LayoutDashboard className="h-5 w-5" />,
      label: 'Overview',
      onClick: () => setActiveSection('overview'),
      active: activeSection === 'overview',
    },
    {
      icon: <Users className="h-5 w-5" />,
      label: 'Manage Users',
      onClick: () => setActiveSection('users'),
      active: activeSection === 'users',
    },
    {
      icon: <Settings className="h-5 w-5" />,
      label: 'Settings',
      onClick: () => setActiveSection('settings'),
      active: activeSection === 'settings',
    },
  ];

  const loadUsers = () => {
    // Use getAllUsers from auth.ts to get users from localStorage
    const allUsersFromAuth = getAllUsers(); // This now returns users with passwords
    
    // Transform the data to match the Profile interface, explicitly omitting password
    const transformedUsers = allUsersFromAuth.map(user => ({
      id: user.id,
      full_name: user.name, // Assuming 'name' in AuthUser maps to 'full_name' in Profile
      email: user.email,
      role: user.role,
      department: user.department || '',
    }));

    setUsers(transformedUsers);
  };

  const handleAddUser = () => {
    // Validation
    if (!newUser.email || !newUser.password || !newUser.full_name) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (newUser.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    try {
      // Generate username from full name (lowercase, no spaces)
      const username = newUser.full_name.toLowerCase().replace(/\s+/g, '.');
      
      // Use addUser from auth.ts
      const success = addUser({
        username,
        password: newUser.password,
        name: newUser.full_name,
        email: newUser.email,
        role: newUser.role,
        department: newUser.department
      });

      if (!success) {
        // addUser returns false if username or email already exists
        toast.error('Username or email already exists. Please use unique credentials.');
        return;
      }

      toast.success('User added successfully');
      setShowAddDialog(false);
      setNewUser({
        email: '',
        password: '',
        full_name: '',
        role: 'student',
        department: '',
      });
      
      // Reload the users list
      loadUsers();
    } catch (error: any) {
      console.error('Error adding user:', error);
      toast.error(error.message || 'Failed to add user');
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUserId) return;

    try {
      const currentUser = getCurrentUser();
      if (!currentUser) {
        throw new Error('Not authenticated');
      }

      if (currentUser.role !== 'admin') {
        throw new Error('Only administrators can delete users');
      }

      // Get the user to delete
      const userToDelete = users.find(u => u.id === selectedUserId);
      if (!userToDelete) {
        throw new Error('User not found');
      }

      // If user is deleting themselves, prevent it
      if (selectedUserId === currentUser.id) {
        throw new Error('You cannot delete your own account');
      }

      // Use the removeUser function from auth.ts, which now filters by unique ID
      const success = removeUser(selectedUserId);
      
      if (!success) {
        throw new Error('Failed to delete user');
      }

      toast.success('User deleted successfully');
      setShowDeleteDialog(false);
      setSelectedUserId(null);
      loadUsers();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast.error(error.message || 'Failed to delete user');
    }
  };

  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const csvContent = event.target?.result as string;
      const lines = csvContent.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        toast.error('CSV file is empty or invalid');
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim());
      const requiredHeaders = ['Full Name', 'Email', 'Password', 'Role'];
      const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));

      if (missingHeaders.length > 0) {
        toast.error(`Missing required CSV headers: ${missingHeaders.join(', ')}`);
        return;
      }

      let successCount = 0;
      let failCount = 0;
      const errors: string[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(s => s.trim());
        const record: { [key: string]: string } = {};
        headers.forEach((header, index) => {
          record[header] = values[index];
        });

        const fullName = record['Full Name'];
        const email = record['Email'];
        const password = record['Password'];
        const role = record['Role'] as UserRole;
        const department = record['Department'] || ''; // Department is optional

        if (!fullName || !email || !password || !role) {
          errors.push(`Skipping row ${i + 1}: Missing required fields.`);
          failCount++;
          continue;
        }

        if (password.length < 6) {
          errors.push(`Skipping row ${i + 1} (${email}): Password must be at least 6 characters.`);
          failCount++;
          continue;
        }

        if (!['admin', 'teacher', 'student'].includes(role)) {
          errors.push(`Skipping row ${i + 1} (${email}): Invalid role '${role}'. Must be 'admin', 'teacher', or 'student'.`);
          failCount++;
          continue;
        }

        try {
          const username = fullName.toLowerCase().replace(/\s+/g, '.');
          const success = addUser({
            username,
            password,
            name: fullName,
            email,
            role,
            department,
          });

          if (!success) {
            errors.push(`Failed to add user ${email}: Username or email already exists.`);
            failCount++;
          } else {
            successCount++;
          }
        } catch (e: any) {
          errors.push(`Failed to add user ${email}: ${e.message}`);
          failCount++;
        }
      }
      
      if (successCount > 0) {
        toast.success(`Successfully added ${successCount} user(s) from CSV.`);
        toast.info('For CSV-uploaded users, the username is derived from "Full Name" (e.g., "John Doe" becomes "john.doe").');
      }
      if (failCount > 0) {
        toast.error(`Failed to add ${failCount} user(s) from CSV. Check console for details.`);
        console.error('CSV Upload Errors:', errors);
      }
      
      loadUsers(); // Reload the users list after processing
    };
    
    reader.readAsText(file);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = ''; // Clear the file input
    }
  };


  return (
    <DashboardLayout sidebarItems={sidebarItems} title="Admin Dashboard">
      {activeSection === 'overview' && (
        <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <Card className="gradient-card shadow-elegant">
            <CardHeader className="pb-3">
              <CardTitle className="text-base sm:text-lg">Total Users</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl sm:text-4xl font-bold">{users.length}</p>
            </CardContent>
          </Card>

          <Card className="gradient-card shadow-elegant">
            <CardHeader className="pb-3">
              <CardTitle className="text-base sm:text-lg">Students</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl sm:text-4xl font-bold">
                {users.filter((u) => u.role === 'student').length}
              </p>
            </CardContent>
          </Card>

          <Card className="gradient-card shadow-elegant">
            <CardHeader className="pb-3">
              <CardTitle className="text-base sm:text-lg">Teachers</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl sm:text-4xl font-bold">
                {users.filter((u) => u.role === 'teacher').length}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {activeSection === 'users' && (
        <div className="space-y-4 sm:space-y-6">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <Button onClick={() => setShowAddDialog(true)} className="w-full sm:w-auto">
              <UserPlus className="h-4 w-4 mr-2" />
              Add User
            </Button>
            <Button variant="secondary" onClick={() => fileInputRef.current?.click()} className="w-full sm:w-auto">
              <Upload className="h-4 w-4 mr-2" />
              Upload CSV
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleCSVUpload}
              className="hidden"
            />
          </div>

          <Card className="shadow-elegant">
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl">All Users</CardTitle>
              <CardDescription className="text-sm">
                Manage user accounts and permissions
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 sm:p-6">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[120px]">Name</TableHead>
                      <TableHead className="hidden sm:table-cell min-w-[150px]">Email</TableHead>
                      <TableHead className="min-w-[80px]">Role</TableHead>
                      <TableHead className="hidden md:table-cell">Department</TableHead>
                      <TableHead className="w-[70px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No users found. Add your first user to get started.
                        </TableCell>
                      </TableRow>
                    ) : (
                      users.map((user) => (
                        <TableRow key={user.id} className="animate-fade-in">
                          <TableCell className="font-medium">{user.full_name}</TableCell>
                          <TableCell className="hidden sm:table-cell text-sm">{user.email}</TableCell>
                          <TableCell>
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary whitespace-nowrap">
                              {user.role}
                            </span>
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-sm">{user.department || '-'}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedUserId(user.id);
                                setShowDeleteDialog(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeSection === 'settings' && (
        <Card className="shadow-elegant">
          <CardHeader>
            <CardTitle>System Settings</CardTitle>
            <CardDescription>Configure platform settings</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Settings panel coming soon...</p>
          </CardContent>
        </Card>
      )}

      {/* Add User Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">Add New User</DialogTitle>
            <DialogDescription className="text-sm">
              Create a new user account with role assignment
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full_name" className="text-sm">Full Name</Label>
              <Input
                id="full_name"
                value={newUser.full_name}
                onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                placeholder="Enter full name"
                className="text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm">Email</Label>
              <Input
                id="email"
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                placeholder="Enter email"
                className="text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm">Password</Label>
              <Input
                id="password"
                type="password"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                placeholder="Enter password (min 6 characters)"
                className="text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="department" className="text-sm">Department (Optional)</Label>
              <Input
                id="department"
                value={newUser.department}
                onChange={(e) => setNewUser({ ...newUser, department: e.target.value })}
                placeholder="Enter department"
                className="text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role" className="text-sm">Role</Label>
              <Select
                value={newUser.role}
                onValueChange={(value: UserRole) =>
                  setNewUser({ ...newUser, role: value })
                }
              >
                <SelectTrigger id="role" className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="teacher">Teacher</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowAddDialog(false)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button onClick={handleAddUser} className="w-full sm:w-auto">Add User</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this user? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteUser}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default AdminDashboard;
