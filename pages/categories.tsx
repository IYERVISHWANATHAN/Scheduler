import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Tags, Plus, Edit, Edit2, Trash2, Save, X, Users, ArrowLeft, ChevronUp, ChevronDown, ChevronRight, ChevronDown as ChevronDownIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import type { DdfsAttendee } from "@shared/schema";

const AVAILABLE_CATEGORIES = [
  { key: 'liquor', label: 'Liquor', color: '#EF4444' },
  { key: 'tobacco', label: 'Tobacco', color: '#F97316' },
  { key: 'pnc', label: 'PNC', color: '#10B981' },
  { key: 'confectionary', label: 'Confectionary', color: '#F59E0B' },
  { key: 'fashion', label: 'Fashion', color: '#EC4899' }
];

interface NewAttendeeForm {
  name: string;
  email: string;
  categories: string[];
  whatsappNumber: string;
  enableWhatsappAlerts: boolean;
}

interface NewCategoryForm {
  key: string;
  label: string;
  color: string;
  description: string;
  selectedAttendees: number[];
}

export default function CategoriesPage() {
  const [editingAttendee, setEditingAttendee] = useState<DdfsAttendee | null>(null);
  const [showNewAttendeeDialog, setShowNewAttendeeDialog] = useState(false);
  const [showNewCategoryDialog, setShowNewCategoryDialog] = useState(false);
  const [showEditCategoryDialog, setShowEditCategoryDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [newAttendeeForm, setNewAttendeeForm] = useState<NewAttendeeForm>({
    name: '',
    email: '',
    categories: [],
    whatsappNumber: '',
    enableWhatsappAlerts: false
  });
  const [newCategoryForm, setNewCategoryForm] = useState<NewCategoryForm>({
    key: '',
    label: '',
    color: '#3B82F6',
    description: '',
    selectedAttendees: []
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const [, setLocation] = useLocation();

  // Fetch DDFS attendees
  const { data: ddfsAttendees = [], isLoading } = useQuery({
    queryKey: ['/api/ddfs-attendees'],
  });

  // Fetch categories
  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ['/api/categories'],
  });

  const updateAttendeeMutation = useMutation({
    mutationFn: async (attendeeData: { id: number; data: Partial<DdfsAttendee> }) => {
      return await apiRequest('PATCH', `/api/ddfs-attendees/${attendeeData.id}`, attendeeData.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ddfs-attendees'] });
      setEditingAttendee(null);
      toast({
        title: "Success",
        description: "Attendee updated successfully"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update attendee",
        variant: "destructive"
      });
    }
  });

  const createAttendeeMutation = useMutation({
    mutationFn: async (attendeeData: Omit<NewAttendeeForm, 'enableWhatsappAlerts'> & { enableWhatsappAlerts: boolean }) => {
      return await apiRequest('POST', '/api/ddfs-attendees', attendeeData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ddfs-attendees'] });
      setShowNewAttendeeDialog(false);
      setNewAttendeeForm({
        name: '',
        email: '',
        categories: [],
        whatsappNumber: '',
        enableWhatsappAlerts: false
      });
      toast({
        title: "Success",
        description: "Attendee created successfully"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create attendee",
        variant: "destructive"
      });
    }
  });

  const deleteAttendeeMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('DELETE', `/api/ddfs-attendees/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ddfs-attendees'] });
      toast({
        title: "Success",
        description: "Attendee deleted successfully"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete attendee",
        variant: "destructive"
      });
    }
  });

  const createCategoryMutation = useMutation({
    mutationFn: async (categoryData: NewCategoryForm) => {
      return await apiRequest('POST', '/api/categories', categoryData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
      setShowNewCategoryDialog(false);
      setNewCategoryForm({
        key: '',
        label: '',
        color: '#3B82F6',
        description: '',
        selectedAttendees: []
      });
      toast({
        title: "Success",
        description: "Category created successfully"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create category",
        variant: "destructive"
      });
    }
  });

  // Edit category mutation
  const editCategoryMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: Partial<NewCategoryForm> }) => {
      return await apiRequest('PATCH', `/api/categories/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
      queryClient.invalidateQueries({ queryKey: ['/api/ddfs-attendees'] });
      setShowEditCategoryDialog(false);
      setEditingCategory(null);
      toast({
        title: "Success",
        description: "Category updated successfully"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update category",
        variant: "destructive"
      });
    }
  });

  const reorderAttendeesMutation = useMutation({
    mutationFn: async (attendeeOrders: { id: number; displayOrder: number }[]) => {
      return await apiRequest('PATCH', '/api/ddfs-attendees/reorder', { attendeeOrders });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ddfs-attendees'] });
      toast({
        title: "Success",
        description: "Attendee order updated successfully"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error", 
        description: error.message || "Failed to update attendee order",
        variant: "destructive"
      });
    }
  });

  const reorderCategoriesMutation = useMutation({
    mutationFn: async ({ categoryId, direction }: { categoryId: number; direction: 'up' | 'down' }) => {
      return await apiRequest('PATCH', '/api/categories/reorder', { categoryId, direction });
    },
    onSuccess: () => {
      // Invalidate all category-related queries to update across all pages
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
      queryClient.invalidateQueries({ queryKey: ['/api/meetings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/ddfs-attendees'] });
      
      // Force refresh of all cached data
      queryClient.refetchQueries({ queryKey: ['/api/categories'] });
      
      toast({
        title: "Success",
        description: "Category order updated successfully"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error", 
        description: error.message || "Failed to update category order",
        variant: "destructive"
      });
    }
  });

  const handleEditAttendee = (attendee: DdfsAttendee) => {
    setEditingAttendee({
      ...attendee,
      categories: Array.isArray(attendee.categories) ? attendee.categories : []
    });
  };

  const handleSaveAttendee = () => {
    if (!editingAttendee) return;
    
    updateAttendeeMutation.mutate({
      id: editingAttendee.id,
      data: {
        name: editingAttendee.name,
        email: editingAttendee.email,
        categories: editingAttendee.categories,
        whatsappNumber: editingAttendee.whatsappNumber,
        enableWhatsappAlerts: editingAttendee.enableWhatsappAlerts
      }
    });
  };

  const handleDeleteAttendee = (id: number) => {
    if (confirm('Are you sure you want to delete this attendee?')) {
      deleteAttendeeMutation.mutate(id);
    }
  };

  const handleCreateAttendee = () => {
    if (!newAttendeeForm.name.trim() || !newAttendeeForm.email.trim()) {
      toast({
        title: "Error",
        description: "Name and email are required",
        variant: "destructive"
      });
      return;
    }

    createAttendeeMutation.mutate(newAttendeeForm);
  };

  const handleCreateCategory = () => {
    if (!newCategoryForm.key.trim() || !newCategoryForm.label.trim()) {
      toast({
        title: "Error",
        description: "Category key and label are required",
        variant: "destructive"
      });
      return;
    }

    // Check if key already exists
    const existingCategory = (categories as any[]).find((cat: any) => cat.key === newCategoryForm.key);
    if (existingCategory) {
      toast({
        title: "Error",
        description: "A category with this key already exists",
        variant: "destructive"
      });
      return;
    }

    createCategoryMutation.mutate(newCategoryForm);
  };

  const handleEditCategory = (category: any) => {
    setEditingCategory({
      ...category,
      selectedAttendees: (ddfsAttendees as any[])
        .filter((attendee: any) => {
          const attendeeCategories = attendee.categories || [];
          return Array.isArray(attendeeCategories) && attendeeCategories.includes(category.key);
        })
        .map((attendee: any) => attendee.id)
    });
    setShowEditCategoryDialog(true);
  };

  const handleUpdateCategory = () => {
    if (!editingCategory.label.trim()) {
      toast({
        title: "Error",
        description: "Category label is required",
        variant: "destructive"
      });
      return;
    }

    editCategoryMutation.mutate({
      id: editingCategory.id,
      data: {
        label: editingCategory.label,
        color: editingCategory.color,
        description: editingCategory.description,
        selectedAttendees: editingCategory.selectedAttendees
      }
    });
  };

  const updateEditingAttendeeCategories = (category: string, checked: boolean) => {
    if (!editingAttendee) return;
    
    const newCategories = checked 
      ? [...editingAttendee.categories, category]
      : editingAttendee.categories.filter(c => c !== category);
    
    setEditingAttendee({
      ...editingAttendee,
      categories: newCategories
    });
  };

  const updateNewAttendeeCategories = (category: string, checked: boolean) => {
    const newCategories = checked 
      ? [...newAttendeeForm.categories, category]
      : newAttendeeForm.categories.filter(c => c !== category);
    
    setNewAttendeeForm({
      ...newAttendeeForm,
      categories: newCategories
    });
  };

  const getAttendeesByCategory = (categoryKey: string) => {
    return (ddfsAttendees as any[]).filter((attendee: any) => {
      // Handle both array and null/undefined cases
      const attendeeCategories = attendee.categories || [];
      return Array.isArray(attendeeCategories) && attendeeCategories.includes(categoryKey);
    });
  };

  const toggleCategoryExpansion = (categoryKey: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryKey)) {
      newExpanded.delete(categoryKey);
    } else {
      newExpanded.add(categoryKey);
    }
    setExpandedCategories(newExpanded);
  };

  const moveCategoryUp = (categoryId: number) => {
    reorderCategoriesMutation.mutate({ categoryId, direction: 'up' });
  };

  const moveCategoryDown = (categoryId: number) => {
    reorderCategoriesMutation.mutate({ categoryId, direction: 'down' });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center py-4 space-y-4 lg:space-y-0">
            <div className="flex flex-col sm:flex-row sm:items-center">
              <Button 
                variant="outline" 
                onClick={() => setLocation('/week')}
                className="mb-4 sm:mb-0 sm:mr-4 w-fit bg-red-600 text-white border-red-600 hover:bg-red-700 hover:border-red-700"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Calendar
              </Button>
              <div>
                <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Manage Categories</h1>
                <p className="text-sm lg:text-base text-gray-600">Configure categories and assign DDFS attendees</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Dialog open={showNewCategoryDialog} onOpenChange={setShowNewCategoryDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Tags className="mr-2 h-4 w-4" />
                    Add Category
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Add New Category</DialogTitle>
                    <DialogDescription>
                      Create a new category for organizing attendees
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="categoryKey">Category Key *</Label>
                      <Input
                        id="categoryKey"
                        value={newCategoryForm.key}
                        onChange={(e) => setNewCategoryForm({ ...newCategoryForm, key: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                        placeholder="e.g., electronics"
                        className="lowercase"
                      />
                      <p className="text-xs text-gray-500 mt-1">Used internally for identification (lowercase, underscores only)</p>
                    </div>
                    <div>
                      <Label htmlFor="categoryLabel">Display Label *</Label>
                      <Input
                        id="categoryLabel"
                        value={newCategoryForm.label}
                        onChange={(e) => setNewCategoryForm({ ...newCategoryForm, label: e.target.value })}
                        placeholder="Electronics"
                      />
                    </div>
                    <div>
                      <Label htmlFor="categoryColor">Color</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="categoryColor"
                          type="color"
                          value={newCategoryForm.color}
                          onChange={(e) => setNewCategoryForm({ ...newCategoryForm, color: e.target.value })}
                          className="w-12 h-10 p-1 border rounded"
                        />
                        <Input
                          value={newCategoryForm.color}
                          onChange={(e) => setNewCategoryForm({ ...newCategoryForm, color: e.target.value })}
                          placeholder="#3B82F6"
                          className="flex-1"
                        />
                      </div>
                    </div>

                    
                    <div>
                      <Label>Assign DDFS Attendees</Label>
                      <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-2">
                        {(ddfsAttendees as any[]) && (ddfsAttendees as any[]).length > 0 ? (
                          (ddfsAttendees as any[]).map((attendee: any) => (
                            <div key={attendee.id} className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id={`attendee-${attendee.id}`}
                                checked={newCategoryForm.selectedAttendees.includes(attendee.id)}
                                onChange={(e) => {
                                  const isChecked = e.target.checked;
                                  setNewCategoryForm(prev => ({
                                    ...prev,
                                    selectedAttendees: isChecked
                                      ? [...prev.selectedAttendees, attendee.id]
                                      : prev.selectedAttendees.filter(id => id !== attendee.id)
                                  }));
                                }}
                                className="rounded border-gray-300"
                              />
                              <label 
                                htmlFor={`attendee-${attendee.id}`}
                                className="text-sm cursor-pointer flex-1"
                              >
                                <div className="font-medium">{attendee.name}</div>
                                <div className="text-gray-500 text-xs">{attendee.email}</div>
                              </label>
                            </div>
                          ))
                        ) : (
                          <div className="text-sm text-gray-500 italic">No DDFS attendees available</div>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Select attendees to assign to this category
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-end space-x-2 pt-4">
                    <Button variant="outline" onClick={() => setShowNewCategoryDialog(false)}>
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleCreateCategory}
                      disabled={createCategoryMutation.isPending}
                    >
                      {createCategoryMutation.isPending ? "Creating..." : "Create Category"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
              
              <Dialog open={showNewAttendeeDialog} onOpenChange={setShowNewAttendeeDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
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
                              onCheckedChange={(checked) => updateNewAttendeeCategories(category.key, checked as boolean)}
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

              {/* Edit Category Dialog */}
              <Dialog open={showEditCategoryDialog} onOpenChange={setShowEditCategoryDialog}>
                <DialogContent className="max-w-md max-h-[85vh] flex flex-col" aria-describedby="edit-category-description">
                  <DialogHeader className="flex-shrink-0">
                    <DialogTitle>Edit Category</DialogTitle>
                    <DialogDescription id="edit-category-description">
                      Update category details and attendee assignments
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                    {editingCategory && (
                      <>
                        <div>
                          <Label htmlFor="editCategoryLabel">Display Label *</Label>
                          <Input
                            id="editCategoryLabel"
                            value={editingCategory.label || ''}
                            onChange={(e) => setEditingCategory({ ...editingCategory, label: e.target.value })}
                            placeholder="Electronics"
                          />
                        </div>
                        <div>
                          <Label htmlFor="editCategoryColor">Color</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              id="editCategoryColor"
                              type="color"
                              value={editingCategory.color || '#3B82F6'}
                              onChange={(e) => setEditingCategory({ ...editingCategory, color: e.target.value })}
                              className="w-12 h-10 p-1 border rounded"
                            />
                            <Input
                              value={editingCategory.color || '#3B82F6'}
                              onChange={(e) => setEditingCategory({ ...editingCategory, color: e.target.value })}
                              placeholder="#3B82F6"
                              className="flex-1"
                            />
                          </div>
                        </div>

                        
                        <div>
                          <Label>Assign DDFS Attendees</Label>
                          <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-2">
                            {(ddfsAttendees as any[]) && (ddfsAttendees as any[]).length > 0 ? (
                              (ddfsAttendees as any[]).map((attendee: any) => (
                                <div key={attendee.id} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`edit-attendee-${attendee.id}`}
                                    checked={editingCategory.selectedAttendees?.includes(attendee.id) || false}
                                    onCheckedChange={(checked) => {
                                      const newSelectedAttendees = checked
                                        ? [...(editingCategory.selectedAttendees || []), attendee.id]
                                        : (editingCategory.selectedAttendees || []).filter((id: any) => id !== attendee.id);
                                      setEditingCategory({ ...editingCategory, selectedAttendees: newSelectedAttendees });
                                    }}
                                  />
                                  <Label htmlFor={`edit-attendee-${attendee.id}`} className="text-sm flex-1">
                                    {attendee.name} ({attendee.email})
                                  </Label>
                                </div>
                              ))
                            ) : (
                              <div className="text-sm text-gray-500 italic">No DDFS attendees available</div>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            Select attendees to assign to this category
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                  
                  <div className="flex-shrink-0 flex justify-end space-x-2 pt-4 border-t bg-white">
                    <Button variant="outline" onClick={() => setShowEditCategoryDialog(false)}>
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleUpdateCategory}
                      disabled={editCategoryMutation.isPending || !editingCategory}
                    >
                      {editCategoryMutation.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500">Loading attendees...</div>
          </div>
        ) : (
          <div className="grid gap-6">
            {/* Categories Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Tags className="mr-2 h-5 w-5" />
                  Categories Overview
                </CardTitle>
                <CardDescription>
                  View attendees organized by category
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {[...(categories as any[])].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0)).map((category: any) => {
                    const categoryAttendees = getAttendeesByCategory(category.key);
                    const isExpanded = expandedCategories.has(category.key);
                    return (
                      <div key={category.key} className="border rounded-lg p-4">
                        <div className="flex items-center mb-3">
                          <div 
                            className="flex items-center flex-1 cursor-pointer hover:bg-gray-50 -m-2 p-2 rounded"
                            onClick={() => toggleCategoryExpansion(category.key)}
                          >
                            <div 
                              className="w-4 h-4 rounded mr-2 flex-shrink-0"
                              style={{ backgroundColor: category.color }}
                            />
                            <h3 className="font-medium flex-1 truncate">{category.label}</h3>
                            <span className="text-sm text-gray-500 mr-2 flex-shrink-0">
                              {categoryAttendees.length}
                            </span>
                            {isExpanded ? (
                              <ChevronDownIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            {/* Reorder buttons */}
                            <div className="flex flex-col">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  moveCategoryUp(category.id);
                                }}
                                className="p-0 h-4 w-6 hover:bg-gray-100"
                                disabled={reorderCategoriesMutation.isPending}
                              >
                                <ChevronUp className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  moveCategoryDown(category.id);
                                }}
                                className="p-0 h-4 w-6 hover:bg-gray-100"
                                disabled={reorderCategoriesMutation.isPending}
                              >
                                <ChevronDown className="h-3 w-3" />
                              </Button>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditCategory(category);
                              }}
                              className="p-1 h-8 w-8"
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          {isExpanded ? (
                            // Show all attendees when expanded
                            categoryAttendees.length > 0 ? (
                              categoryAttendees.map((attendee: DdfsAttendee) => (
                                <div key={attendee.id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                                  <div className="flex-1 truncate">
                                    <div className="font-medium truncate">{attendee.name}</div>
                                    <div className="text-gray-500 text-xs truncate">{attendee.email}</div>
                                  </div>
                                  <div className="flex items-center space-x-1 ml-2 flex-shrink-0">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleEditAttendee(attendee);
                                      }}
                                      className="h-6 w-6 p-0"
                                    >
                                      <Edit className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteAttendee(attendee.id);
                                      }}
                                      className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="text-sm text-gray-400 italic">No attendees in this category</div>
                            )
                          ) : (
                            // Show preview when collapsed
                            <>
                              {categoryAttendees.slice(0, 2).map((attendee: DdfsAttendee) => (
                                <div key={attendee.id} className="text-sm text-gray-600 truncate">
                                  {attendee.name}
                                </div>
                              ))}
                              {categoryAttendees.length > 2 && (
                                <div className="text-sm text-gray-400">
                                  +{categoryAttendees.length - 2} more
                                </div>
                              )}
                              {categoryAttendees.length === 0 && (
                                <div className="text-sm text-gray-400 italic">No attendees</div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>


          </div>
        )}
      </div>
    </div>
  );
}