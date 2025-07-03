import { useState, useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Settings, Plus, Edit, Trash2, Save, X, Users, UserPlus, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { TimezoneSelector } from "@/components/timezone-selector";
import type { User, UserRole, DEFAULT_TIMEZONE, DdfsAttendee } from "@shared/schema";

interface UserWithPermissions extends User {
  permissions: {
    canView: boolean;
    canSchedule: boolean;
    canEdit: boolean;
    categories: string[];
  };
}

interface NewUserForm {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  customPermissions: {
    canView: boolean;
    canSchedule: boolean;
    canEdit: boolean;
    categories: string[];
  };
}

const AVAILABLE_ROLES: UserRole[] = ['admin', 'liquor_tobacco', 'pnc_confectionary_fashion', 'guest'];

interface NewAttendeeForm {
  name: string;
  email: string;
  categories: string[];
  whatsappNumber: string;
  enableWhatsappAlerts: boolean;
}

export default function SettingsPage() {
  const [editingUser, setEditingUser] = useState<UserWithPermissions | null>(null);
  const [showNewUserDialog, setShowNewUserDialog] = useState(false);
  const [editingAttendee, setEditingAttendee] = useState<DdfsAttendee | null>(null);
  const [showNewAttendeeDialog, setShowNewAttendeeDialog] = useState(false);

  const [newUserForm, setNewUserForm] = useState<NewUserForm>({
    name: '',
    email: '',
    password: '',
    role: 'guest',
    customPermissions: {
      canView: true,
      canSchedule: false,
      canEdit: false,
      categories: []
    }
  });

  const [newAttendeeForm, setNewAttendeeForm] = useState<NewAttendeeForm>({
    name: '',
    email: '',
    categories: [],
    whatsappNumber: '',
    enableWhatsappAlerts: false
  });


  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user: currentUser, permissions } = useAuth();
  const [, setLocation] = useLocation();

  // Only admin (User 1) can access settings
  if (currentUser?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">Only administrators can access user settings.</p>
        </div>
      </div>
    );
  }

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['/api/users'],
    enabled: true
  });



  const { data: globalSettings = [] } = useQuery({
    queryKey: ['/api/settings'],
    enabled: true
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['/api/categories'],
    enabled: true
  });

  const { data: ddfsAttendees = [] } = useQuery({
    queryKey: ['/api/ddfs-attendees'],
    enabled: true
  });

  // Debug categories data
  useEffect(() => {
    console.log('Categories API data:', categories);
    if (Array.isArray(categories) && categories.length > 0) {
      categories.forEach((cat: any) => {
        console.log(`Category: ${cat.key} - ${cat.label} - ${cat.color}`);
      });
    }
  }, [categories]);

  // Create category color mapping
  const getCategoryColor = (categoryKey: string) => {
    const category = (categories as any[]).find((c: any) => c.key === categoryKey);
    console.log(`Getting color for ${categoryKey}:`, category?.color || '#3B82F6');
    return category?.color || '#3B82F6'; // Default blue if category not found
  };

  const getCategoryBadgeClasses = (categoryKey: string) => {
    const color = getCategoryColor(categoryKey);
    // Convert hex to lighter background and text colors
    const baseClasses = "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize";
    return `${baseClasses} text-white`;
  };

  // Get available category keys from the API data
  const availableCategories = categories.map((cat: any) => cat.key);

  const updateUserMutation = useMutation({
    mutationFn: async (userData: { id: number; permissions: any }) => {
      return await apiRequest('PATCH', `/api/users/${userData.id}`, userData.permissions);
    },
    onSuccess: () => {
      toast({
        title: "User Updated",
        description: "User permissions have been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setEditingUser(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const createUserMutation = useMutation({
    mutationFn: async (userData: NewUserForm) => {
      return await apiRequest('POST', '/api/users', userData);
    },
    onSuccess: () => {
      toast({
        title: "User Created",
        description: "New user has been created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setShowNewUserDialog(false);
      setNewUserForm({
        name: '',
        email: '',
        password: '',
        role: 'guest',
        customPermissions: {
          canView: true,
          canSchedule: false,
          canEdit: false,
          categories: []
        }
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Creation Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      return await apiRequest('DELETE', `/api/users/${userId}`);
    },
    onSuccess: () => {
      toast({
        title: "User Deleted",
        description: "User has been deleted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Deletion Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });





  const updateGlobalTimezoneMutation = useMutation({
    mutationFn: async (timezone: string) => {
      return await apiRequest('PUT', '/api/settings/timezone', { timezone });
    },
    onSuccess: () => {
      toast({
        title: "Timezone Updated",
        description: "System timezone has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const createAttendeeMutation = useMutation({
    mutationFn: async (attendeeData: NewAttendeeForm) => {
      return await apiRequest('POST', '/api/ddfs-attendees', attendeeData);
    },
    onSuccess: () => {
      toast({
        title: "Attendee Created",
        description: "New DDFS attendee has been added successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/ddfs-attendees'] });
      setShowNewAttendeeDialog(false);
      setNewAttendeeForm({ name: '', email: '', categories: [], whatsappNumber: '', enableWhatsappAlerts: false });
    },
    onError: (error: Error) => {
      toast({
        title: "Creation Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const updateAttendeeMutation = useMutation({
    mutationFn: async (attendeeData: DdfsAttendee) => {
      return await apiRequest('PATCH', `/api/ddfs-attendees/${attendeeData.id}`, {
        name: attendeeData.name,
        email: attendeeData.email,
        categories: attendeeData.categories,
        whatsappNumber: attendeeData.whatsappNumber,
        enableWhatsappAlerts: attendeeData.enableWhatsappAlerts
      });
    },
    onSuccess: () => {
      toast({
        title: "Attendee Updated",
        description: "DDFS attendee has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/ddfs-attendees'] });
      setEditingAttendee(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const deleteAttendeeMutation = useMutation({
    mutationFn: async (attendeeId: number) => {
      return await apiRequest('DELETE', `/api/ddfs-attendees/${attendeeId}`);
    },
    onSuccess: () => {
      toast({
        title: "Attendee Deleted",
        description: "DDFS attendee has been removed successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/ddfs-attendees'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Deletion Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const reorderAttendeesMutation = useMutation({
    mutationFn: async (attendeeOrders: Array<{ id: number; displayOrder: number }>) => {
      return await apiRequest('PATCH', '/api/ddfs-attendees/reorder', { attendeeOrders });
    },
    onSuccess: () => {
      toast({
        title: "Order Updated",
        description: "DDFS attendee order has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/ddfs-attendees'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Reorder Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleEditUser = (user: User) => {
    const userWithPermissions: UserWithPermissions = {
      ...user,
      permissions: getUserPermissions(user)
    };
    setEditingUser(userWithPermissions);
  };

  const getUserPermissions = (user: User) => {
    // Get default permissions based on role
    const rolePermissions = {
      admin: { canView: true, canSchedule: true, canEdit: true, categories: availableCategories },
      liquor_tobacco: { canView: true, canSchedule: true, canEdit: true, categories: ['liquor', 'tobacco'] },
      pnc_confectionary_fashion: { canView: true, canSchedule: true, canEdit: true, categories: ['pnc', 'confectionary', 'fashion'] },
      guest: { canView: true, canSchedule: false, canEdit: false, categories: [] },
      vendor: { canView: false, canSchedule: true, canEdit: false, categories: [] }
    };

    // Get role permissions with fallback to guest
    const role = user.role as UserRole;
    const defaultPermissions = rolePermissions[role] || rolePermissions.guest;

    // Parse custom permissions if they exist
    try {
      const customPermissions = user.customPermissions ? JSON.parse(user.customPermissions) : {};
      return { ...defaultPermissions, ...customPermissions };
    } catch {
      return defaultPermissions;
    }
  };

  const handleSaveUser = () => {
    if (editingUser) {
      updateUserMutation.mutate({
        id: editingUser.id,
        permissions: editingUser.permissions
      });
    }
  };

  const handleCreateUser = () => {
    createUserMutation.mutate(newUserForm);
  };

  const handleDeleteUser = (userId: number) => {
    if (userId === currentUser?.id) {
      toast({
        title: "Cannot Delete",
        description: "You cannot delete your own account.",
        variant: "destructive",
      });
      return;
    }
    
    if (confirm('Are you sure you want to delete this user?')) {
      deleteUserMutation.mutate(userId);
    }
  };

  const updateEditingUserPermission = (key: string, value: any) => {
    if (editingUser) {
      setEditingUser({
        ...editingUser,
        permissions: {
          ...editingUser.permissions,
          [key]: value
        }
      });
    }
  };

  const moveAttendeeUp = (attendeeId: number) => {
    if (!ddfsAttendees || !Array.isArray(ddfsAttendees)) return;
    
    const sortedAttendees = [...ddfsAttendees].sort((a: DdfsAttendee, b: DdfsAttendee) => 
      (a.displayOrder || 0) - (b.displayOrder || 0)
    );
    
    const currentIndex = sortedAttendees.findIndex((a: DdfsAttendee) => a.id === attendeeId);
    if (currentIndex <= 0) return;
    
    const attendeeOrders = sortedAttendees.map((attendee: DdfsAttendee, index: number) => {
      if (index === currentIndex) {
        return { id: attendee.id, displayOrder: currentIndex };
      } else if (index === currentIndex - 1) {
        return { id: attendee.id, displayOrder: currentIndex + 1 };
      } else {
        return { id: attendee.id, displayOrder: index + 1 };
      }
    });
    
    reorderAttendeesMutation.mutate(attendeeOrders);
  };

  const moveAttendeeDown = (attendeeId: number) => {
    if (!ddfsAttendees || !Array.isArray(ddfsAttendees)) return;
    
    const sortedAttendees = [...ddfsAttendees].sort((a: DdfsAttendee, b: DdfsAttendee) => 
      (a.displayOrder || 0) - (b.displayOrder || 0)
    );
    
    const currentIndex = sortedAttendees.findIndex((a: DdfsAttendee) => a.id === attendeeId);
    if (currentIndex >= sortedAttendees.length - 1) return;
    
    const attendeeOrders = sortedAttendees.map((attendee: DdfsAttendee, index: number) => {
      if (index === currentIndex) {
        return { id: attendee.id, displayOrder: currentIndex + 2 };
      } else if (index === currentIndex + 1) {
        return { id: attendee.id, displayOrder: currentIndex + 1 };
      } else {
        return { id: attendee.id, displayOrder: index + 1 };
      }
    });
    
    reorderAttendeesMutation.mutate(attendeeOrders);
  };

  const updateNewUserPermission = (key: string, value: any) => {
    setNewUserForm({
      ...newUserForm,
      customPermissions: {
        ...newUserForm.customPermissions,
        [key]: value
      }
    });
  };

  const toggleCategory = (category: string, isEditing = false) => {
    const permissions = isEditing ? editingUser?.permissions : newUserForm.customPermissions;
    const currentCategories = permissions?.categories || [];
    const newCategories = currentCategories.includes(category)
      ? currentCategories.filter(c => c !== category)
      : [...currentCategories, category];

    if (isEditing) {
      updateEditingUserPermission('categories', newCategories);
    } else {
      updateNewUserPermission('categories', newCategories);
    }
  };

  const toggleAttendeeCategory = (category: string, isEditing = false) => {
    if (isEditing && editingAttendee) {
      const currentCategories = editingAttendee.categories || [];
      const newCategories = currentCategories.includes(category)
        ? currentCategories.filter(c => c !== category)
        : [...currentCategories, category];
      
      setEditingAttendee({
        ...editingAttendee,
        categories: newCategories
      });
    } else {
      const currentCategories = newAttendeeForm.categories;
      const newCategories = currentCategories.includes(category)
        ? currentCategories.filter(c => c !== category)
        : [...currentCategories, category];
      
      setNewAttendeeForm({
        ...newAttendeeForm,
        categories: newCategories
      });
    }
  };

  const handleCreateAttendee = () => {
    createAttendeeMutation.mutate(newAttendeeForm);
  };

  const handleUpdateAttendee = () => {
    if (editingAttendee) {
      updateAttendeeMutation.mutate(editingAttendee);
    }
  };

  const handleDeleteAttendee = (attendeeId: number) => {
    if (confirm('Are you sure you want to delete this DDFS attendee?')) {
      deleteAttendeeMutation.mutate(attendeeId);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
          <div className="py-4 space-y-3">
            <div className="flex items-center">
              <Settings className="text-blue-600 text-lg sm:text-2xl mr-2 sm:mr-3" />
              <h1 className="text-lg sm:text-xl font-semibold text-gray-900">User Settings</h1>
            </div>
            <div className="flex justify-between items-center">
              <Dialog open={showNewUserDialog} onOpenChange={setShowNewUserDialog}>
                <DialogTrigger asChild>
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="mr-2 h-4 w-4" />
                    Add New User
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Create New User</DialogTitle>
                    <DialogDescription>
                      Add a new user to the system and configure their permissions.
                    </DialogDescription>
                  </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name">Name</Label>
                      <Input
                        id="name"
                        value={newUserForm.name}
                        onChange={(e) => setNewUserForm({ ...newUserForm, name: e.target.value })}
                        placeholder="Full Name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">Email (User ID)</Label>
                      <Input
                        id="email"
                        type="email"
                        value={newUserForm.email}
                        onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                        placeholder="user@example.com"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="password">Password</Label>
                      <Input
                        id="password"
                        type="password"
                        value={newUserForm.password}
                        onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                        placeholder="Password"
                      />
                    </div>
                    <div>
                      <Label htmlFor="role">Role</Label>
                      <Select value={newUserForm.role} onValueChange={(value: UserRole) => setNewUserForm({ ...newUserForm, role: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Administrator</SelectItem>
                          <SelectItem value="liquor_tobacco">Liquor & Tobacco Manager</SelectItem>
                          <SelectItem value="pnc_confectionary_fashion">PNC, Confectionary & Fashion Manager</SelectItem>
                          <SelectItem value="guest">Guest</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="space-y-4 border-t pt-4">
                    <h4 className="font-medium">Permissions</h4>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="canView"
                          checked={newUserForm.customPermissions.canView}
                          onCheckedChange={(checked) => updateNewUserPermission('canView', checked)}
                        />
                        <Label htmlFor="canView">Can View</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="canSchedule"
                          checked={newUserForm.customPermissions.canSchedule}
                          onCheckedChange={(checked) => updateNewUserPermission('canSchedule', checked)}
                        />
                        <Label htmlFor="canSchedule">Can Schedule</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="canEdit"
                          checked={newUserForm.customPermissions.canEdit}
                          onCheckedChange={(checked) => updateNewUserPermission('canEdit', checked)}
                        />
                        <Label htmlFor="canEdit">Can Edit</Label>
                      </div>
                    </div>
                    
                    <div>
                      <Label>Categories</Label>
                      <div className="grid grid-cols-3 gap-2 mt-2">
                        {availableCategories.map(category => (
                          <div key={category} className="flex items-center space-x-2">
                            <Checkbox
                              id={`new-${category}`}
                              checked={newUserForm.customPermissions.categories.includes(category)}
                              onCheckedChange={() => toggleCategory(category, false)}
                            />
                            <Label htmlFor={`new-${category}`} className="capitalize">{category}</Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setShowNewUserDialog(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreateUser} disabled={createUserMutation.isPending}>
                      {createUserMutation.isPending ? 'Creating...' : 'Create User'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
              <Button 
                variant="outline" 
                onClick={() => setLocation('/week')}
                className="px-4 bg-red-600 text-white border-red-600 hover:bg-red-700 hover:border-red-700"
              >
                <X className="mr-2 h-4 w-4" />
                Close
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500">Loading users...</div>
          </div>
        ) : (
          <div className="grid gap-6">
            {/* Global Settings Section */}
            <Card className="w-full">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Settings className="mr-2 h-5 w-5" />
                  Calendar Settings
                </CardTitle>
                <CardDescription>
                  Configure system-wide calendar settings for all users
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Calendar Timezone</h4>
                    <p className="text-sm text-gray-600 mb-3">
                      This timezone will be used for all calendar events and meetings across the system.
                    </p>
                    <div className="max-w-xs">
                      <TimezoneSelector
                        value={globalSettings.find((s: any) => s.settingKey === 'timezone')?.settingValue || "Europe/Berlin"}
                        onChange={(timezone) => updateGlobalTimezoneMutation.mutate(timezone)}
                        disabled={updateGlobalTimezoneMutation.isPending}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            {users.map((user: User) => {
              const userPermissions = getUserPermissions(user);
              const isEditing = editingUser?.id === user.id;
              
              return (
                <Card key={user.id} className="w-full">
                  <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start space-y-3 sm:space-y-0">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="flex items-center flex-wrap">
                          <Users className="mr-2 h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                          <span className="truncate">{user.name}</span>
                          {user.id === currentUser?.id && (
                            <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full flex-shrink-0">
                              You
                            </span>
                          )}
                        </CardTitle>
                        <CardDescription className="mt-1 text-sm break-words">
                          <div className="truncate">{user.email}</div>
                          <div className="text-xs mt-1">{user.role.replace('_', ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}</div>
                        </CardDescription>
                      </div>
                      <div className="flex space-x-1 sm:space-x-2 flex-shrink-0">
                        {isEditing ? (
                          <>
                            <Button size="sm" onClick={handleSaveUser} disabled={updateUserMutation.isPending}>
                              <Save className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setEditingUser(null)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button size="sm" variant="outline" onClick={() => handleEditUser(user)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            {user.id !== currentUser?.id && (
                              <Button 
                                size="sm" 
                                variant="outline" 
                                onClick={() => handleDeleteUser(user.id)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium mb-2">Permissions</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              checked={isEditing ? editingUser.permissions.canView : userPermissions.canView}
                              onCheckedChange={(checked) => isEditing && updateEditingUserPermission('canView', checked)}
                              disabled={!isEditing}
                            />
                            <Label className="text-sm">Can View</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              checked={isEditing ? editingUser.permissions.canSchedule : userPermissions.canSchedule}
                              onCheckedChange={(checked) => isEditing && updateEditingUserPermission('canSchedule', checked)}
                              disabled={!isEditing}
                            />
                            <Label className="text-sm">Can Schedule</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              checked={isEditing ? editingUser.permissions.canEdit : userPermissions.canEdit}
                              onCheckedChange={(checked) => isEditing && updateEditingUserPermission('canEdit', checked)}
                              disabled={!isEditing}
                            />
                            <Label className="text-sm">Can Edit</Label>
                          </div>
                        </div>
                      </div>
                      


                      <div>
                        <h4 className="font-medium mb-2">Categories</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                          {availableCategories.map(category => {
                            const hasAccess = isEditing 
                              ? editingUser.permissions.categories.includes(category)
                              : userPermissions.categories.includes(category);
                            
                            return (
                              <div key={category} className="flex items-center space-x-2">
                                <Checkbox
                                  checked={hasAccess}
                                  onCheckedChange={() => isEditing && toggleCategory(category, true)}
                                  disabled={!isEditing}
                                />
                                <Label className="capitalize text-sm whitespace-nowrap">{category}</Label>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Manage Attendees Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="mr-2 h-5 w-5" />
              Manage Attendees
            </CardTitle>
            <CardDescription>
              Add, edit, and manage DDFS attendees and their category assignments
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">DDFS Attendees</h3>
              <Dialog open={showNewAttendeeDialog} onOpenChange={setShowNewAttendeeDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Add Attendee
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Add New DDFS Attendee</DialogTitle>
                    <DialogDescription>
                      Create a new attendee and assign them to categories
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="name">Name *</Label>
                      <Input
                        id="name"
                        value={newAttendeeForm.name}
                        onChange={(e) => setNewAttendeeForm({ ...newAttendeeForm, name: e.target.value })}
                        placeholder="Enter attendee name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={newAttendeeForm.email}
                        onChange={(e) => setNewAttendeeForm({ ...newAttendeeForm, email: e.target.value })}
                        placeholder="Enter email address"
                      />
                    </div>
                    <div>
                      <Label htmlFor="whatsapp">WhatsApp Number</Label>
                      <Input
                        id="whatsapp"
                        value={newAttendeeForm.whatsappNumber}
                        onChange={(e) => setNewAttendeeForm({ ...newAttendeeForm, whatsappNumber: e.target.value })}
                        placeholder="+49 123 456 7890"
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="enableWhatsappAlerts"
                        checked={newAttendeeForm.enableWhatsappAlerts}
                        onCheckedChange={(checked) => setNewAttendeeForm({ ...newAttendeeForm, enableWhatsappAlerts: checked as boolean })}
                      />
                      <Label htmlFor="enableWhatsappAlerts" className="text-sm">Enable WhatsApp Alerts</Label>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Categories</Label>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        {(categories as any[]).map((category: any) => (
                          <div key={category.key} className="flex items-center space-x-2">
                            <Checkbox
                              id={`new-${category.key}`}
                              checked={newAttendeeForm.categories.includes(category.key)}
                              onCheckedChange={(checked) => toggleAttendeeCategory(category.key, checked as boolean)}
                            />
                            <Label className="text-sm">{category.label}</Label>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex justify-end space-x-2">
                      <Button variant="outline" onClick={() => setShowNewAttendeeDialog(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleCreateAttendee} disabled={createAttendeeMutation.isPending}>
                        {createAttendeeMutation.isPending ? 'Creating...' : 'Create Attendee'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="space-y-3">
              {(ddfsAttendees as any[]).map((attendee: any) => (
                <div key={attendee.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h4 className="font-medium">{attendee.name}</h4>
                        <span className="text-sm text-gray-500">({attendee.email})</span>
                      </div>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {attendee.categories && attendee.categories.map((categoryKey: string) => {
                          const category = (categories as any[]).find((cat: any) => cat.key === categoryKey);
                          return category ? (
                            <span
                              key={categoryKey}
                              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-white"
                              style={{ backgroundColor: category.color }}
                            >
                              {category.label}
                            </span>
                          ) : null;
                        })}
                      </div>
                      {attendee.whatsappNumber && (
                        <div className="text-sm text-gray-600">
                          WhatsApp: {attendee.whatsappNumber}
                          {attendee.enableWhatsappAlerts && (
                            <span className="ml-2 text-green-600">• Alerts Enabled</span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex space-x-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingAttendee(attendee)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteAttendee(attendee.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Edit Attendee Dialog */}
            {editingAttendee && (
              <Dialog open={!!editingAttendee} onOpenChange={() => setEditingAttendee(null)}>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Edit DDFS Attendee</DialogTitle>
                    <DialogDescription>
                      Update attendee information and category assignments
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="editName">Name *</Label>
                      <Input
                        id="editName"
                        value={editingAttendee.name}
                        onChange={(e) => setEditingAttendee({ ...editingAttendee, name: e.target.value })}
                        placeholder="Enter attendee name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="editEmail">Email *</Label>
                      <Input
                        id="editEmail"
                        type="email"
                        value={editingAttendee.email}
                        onChange={(e) => setEditingAttendee({ ...editingAttendee, email: e.target.value })}
                        placeholder="Enter email address"
                      />
                    </div>
                    <div>
                      <Label htmlFor="editWhatsapp">WhatsApp Number</Label>
                      <Input
                        id="editWhatsapp"
                        value={editingAttendee.whatsappNumber || ''}
                        onChange={(e) => setEditingAttendee({ ...editingAttendee, whatsappNumber: e.target.value })}
                        placeholder="+49 123 456 7890"
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="editEnableWhatsappAlerts"
                        checked={editingAttendee.enableWhatsappAlerts || false}
                        onCheckedChange={(checked) => setEditingAttendee({ ...editingAttendee, enableWhatsappAlerts: checked as boolean })}
                      />
                      <Label htmlFor="editEnableWhatsappAlerts" className="text-sm">Enable WhatsApp Alerts</Label>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Categories</Label>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        {(categories as any[]).map((category: any) => (
                          <div key={category.key} className="flex items-center space-x-2">
                            <Checkbox
                              id={`edit-${category.key}`}
                              checked={editingAttendee.categories?.includes(category.key) || false}
                              onCheckedChange={(checked) => toggleAttendeeCategory(category.key, true)}
                            />
                            <Label className="text-sm">{category.label}</Label>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex justify-end space-x-2">
                      <Button variant="outline" onClick={() => setEditingAttendee(null)}>
                        Cancel
                      </Button>
                      <Button onClick={handleUpdateAttendee} disabled={updateAttendeeMutation.isPending}>
                        {updateAttendeeMutation.isPending ? 'Updating...' : 'Update Attendee'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}