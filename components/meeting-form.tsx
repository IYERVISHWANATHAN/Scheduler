import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, X, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { generateTimeSlots } from "@/lib/utils";
import { insertMeetingSchema, type Meeting, type DdfsAttendee, CATEGORY_ATTENDEES } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { AISuggestions } from "@/components/ai-suggestions";

const formSchema = insertMeetingSchema.extend({
  brandAttendees: z.array(z.object({
    name: z.string().min(1, "Name is required"),
    designation: z.string().min(1, "Designation is required")
  })).default([])
});

type FormData = z.infer<typeof formSchema>;

interface MeetingFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  selectedDate: Date;
  editingMeeting?: Meeting | null;
  voiceFormData?: any;
}

interface ConflictError {
  message: string;
  conflicts: string[];
}

export function MeetingForm({ open, onClose, onSuccess, selectedDate, editingMeeting, voiceFormData }: MeetingFormProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [availableAttendees, setAvailableAttendees] = useState<string[]>([]);
  const [selectedAttendees, setSelectedAttendees] = useState<string[]>([]);
  const [mandatoryAttendees, setMandatoryAttendees] = useState<string[]>([]);
  const [brandAttendees, setBrandAttendees] = useState<Array<{name: string, designation: string}>>([]);
  const [conflictError, setConflictError] = useState<ConflictError | null>(null);
  const [bufferWarning, setBufferWarning] = useState<{ attendees: string[] } | null>(null);
  const [showBufferDialog, setShowBufferDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<FormData | null>(null);
  
  const { toast } = useToast();
  const { permissions } = useAuth();
  const timeSlots = generateTimeSlots();

  // Fetch DDFS attendees
  const { data: ddfsAttendees = [] } = useQuery<DdfsAttendee[]>({
    queryKey: ['/api/ddfs-attendees'],
  });

  // Fetch dynamic categories
  const { data: dynamicCategories = [] } = useQuery({
    queryKey: ['/api/categories'],
  });

  // Fetch global settings for timezone
  const { data: globalSettings = [] } = useQuery({
    queryKey: ['/api/settings'],
  });

  // Get current timezone from global settings
  const currentTimezone = (globalSettings as any[]).find((setting: any) => setting.settingKey === 'default_timezone')?.settingValue || 'Europe/Berlin';
  
  // Helper function to get timezone display name
  const getTimezoneDisplayName = (timezone: string) => {
    const timezoneNames: { [key: string]: string } = {
      'America/New_York': 'Eastern Time (ET)',
      'America/Chicago': 'Central Time (CT)',
      'America/Denver': 'Mountain Time (MT)',
      'America/Los_Angeles': 'Pacific Time (PT)',
      'Europe/London': 'Greenwich Mean Time (GMT)',
      'Europe/Berlin': 'Central European Time (CET)',
      'Europe/Moscow': 'Moscow Time (MSK)',
      'Asia/Dubai': 'Gulf Standard Time (GST)',
      'Asia/Kolkata': 'India Standard Time (IST)',
      'Asia/Shanghai': 'China Standard Time (CST)',
      'Asia/Tokyo': 'Japan Standard Time (JST)',
      'Australia/Sydney': 'Australian Eastern Time (AET)',
      'Pacific/Auckland': 'New Zealand Time (NZT)'
    };
    return timezoneNames[timezone] || timezone;
  };

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      schedulerName: "",
      category: "",
      date: format(selectedDate, 'yyyy-MM-dd'),
      startTime: "09:00",
      endTime: "10:00",
      location: "",
      status: "confirmed",
      ddfsAttendees: [],
      mandatoryAttendees: [],
      brandAttendees: []
    }
  });

  // Filter categories based on user permissions
  const { user } = useAuth();
  const availableCategories = (dynamicCategories as any[])
    .filter((cat: any) => {
      if (!cat.isActive) return false;
      // All users can see all categories for meeting scheduling
      return true;
    })
    .map((cat: any) => ({ value: cat.key, label: cat.label }));
  
  console.log("=== MeetingForm Debug ===");
  console.log("User role:", user?.role);
  console.log("User permissions:", permissions);
  console.log("Raw dynamic categories:", dynamicCategories);
  console.log("Filtered available categories:", availableCategories);
  console.log("Selected category state:", selectedCategory);
  console.log("Form category value:", form.getValues("category"));
  console.log("========================");

  // Reset form when dialog opens/closes or editing meeting changes
  useEffect(() => {
    if (open) {
      if (editingMeeting) {
        // Check if user has permission to edit this meeting category
        if (!permissions?.canEdit || (!permissions?.categories.includes(editingMeeting.category) && user?.role !== 'guest' && user?.role !== 'vendor')) {
          toast({
            title: "Access Denied",
            description: "Access to edit this meeting restricted",
            variant: "destructive"
          });
          onClose();
          return;
        }
        
        // Pre-fill form with editing meeting data
        form.reset({
          title: editingMeeting.title,
          schedulerName: editingMeeting.schedulerName,
          category: editingMeeting.category,
          date: editingMeeting.date,
          startTime: editingMeeting.startTime,
          endTime: editingMeeting.endTime,
          location: editingMeeting.location,
          status: editingMeeting.status as "confirmed" | "tentative",
          ddfsAttendees: editingMeeting.ddfsAttendees,
          mandatoryAttendees: editingMeeting.mandatoryAttendees,
          brandAttendees: editingMeeting.brandAttendees.map(attendee => {
            try {
              return JSON.parse(attendee);
            } catch {
              return { name: attendee, designation: "" };
            }
          })
        });
        setSelectedCategory(editingMeeting.category);
        setSelectedAttendees(editingMeeting.ddfsAttendees);
        setMandatoryAttendees(editingMeeting.mandatoryAttendees);
        setBrandAttendees(editingMeeting.brandAttendees.map(attendee => {
          try {
            return JSON.parse(attendee);
          } catch {
            return { name: attendee, designation: "" };
          }
        }));
      } else {
        // Reset for new meeting, with voice data if available
        const formData = {
          title: voiceFormData?.title || "",
          schedulerName: voiceFormData?.schedulerName || "",
          category: voiceFormData?.category || "",
          date: voiceFormData?.date ? format(voiceFormData.date, 'yyyy-MM-dd') : format(selectedDate, 'yyyy-MM-dd'),
          startTime: voiceFormData?.startTime || "09:00",
          endTime: voiceFormData?.endTime || "10:00",
          location: voiceFormData?.location || "",
          status: "confirmed" as const,
          ddfsAttendees: [],
          mandatoryAttendees: [],
          brandAttendees: []
        };
        
        form.reset(formData);
        setSelectedCategory(voiceFormData?.category || "");
        setSelectedAttendees([]);
        setMandatoryAttendees([]);
        setBrandAttendees([]);
      }
      setConflictError(null);
    }
  }, [open, editingMeeting, selectedDate, form, voiceFormData]);

  // Update available attendees when category changes - now using DDFS attendees
  useEffect(() => {
    if (selectedCategory && ddfsAttendees.length > 0) {
      const categoryAttendees = ddfsAttendees
        .filter((attendee: DdfsAttendee) => 
          attendee.categories && attendee.categories.includes(selectedCategory) && attendee.isActive !== false
        )
        .map((attendee: DdfsAttendee) => attendee.name);
      
      setAvailableAttendees(categoryAttendees);
    } else {
      setAvailableAttendees([]);
    }
  }, [selectedCategory, ddfsAttendees]);

  const handleCategoryChange = (category: string) => {
    console.log("Category selected:", category);
    setSelectedCategory(category);
    form.setValue("category", category, { shouldValidate: true });
    console.log("Form category value after set:", form.getValues("category"));
    
    // Reset attendees when category changes
    setSelectedAttendees([]);
    setMandatoryAttendees([]);
    form.setValue("ddfsAttendees", []);
    form.setValue("mandatoryAttendees", []);
  };

  const handleAttendeeToggle = (attendee: string, checked: boolean) => {
    if (checked) {
      const newSelected = [...selectedAttendees, attendee];
      setSelectedAttendees(newSelected);
      form.setValue('ddfsAttendees', newSelected);
    } else {
      const newSelected = selectedAttendees.filter(a => a !== attendee);
      const newMandatory = mandatoryAttendees.filter(a => a !== attendee);
      setSelectedAttendees(newSelected);
      setMandatoryAttendees(newMandatory);
      form.setValue('ddfsAttendees', newSelected);
      form.setValue('mandatoryAttendees', newMandatory);
    }
  };

  const handleMandatoryToggle = (attendee: string, isMandatory: boolean) => {
    if (isMandatory) {
      const newMandatory = [...mandatoryAttendees, attendee];
      setMandatoryAttendees(newMandatory);
      form.setValue('mandatoryAttendees', newMandatory);
    } else {
      const newMandatory = mandatoryAttendees.filter(a => a !== attendee);
      setMandatoryAttendees(newMandatory);
      form.setValue('mandatoryAttendees', newMandatory);
    }
  };

  const addBrandAttendee = () => {
    setBrandAttendees(prev => [...prev, { name: "", designation: "" }]);
  };

  const removeBrandAttendee = (index: number) => {
    setBrandAttendees(prev => prev.filter((_, i) => i !== index));
  };

  const updateBrandAttendee = (index: number, field: "name" | "designation", value: string) => {
    setBrandAttendees(prev => prev.map((attendee, i) => 
      i === index ? { ...attendee, [field]: value } : attendee
    ));
  };

  const submitMeeting = async (meetingData: any) => {
    try {
      console.log("📡 Making API request with data:", meetingData);
      
      if (editingMeeting) {
        await apiRequest("PUT", `/api/meetings/${editingMeeting.id}`, meetingData);
        toast({
          title: "Success",
          description: "Meeting updated successfully"
        });
      } else {
        const response = await apiRequest("POST", "/api/meetings", meetingData);
        console.log("✅ Meeting created successfully:", response);
        toast({
          title: "Success", 
          description: "Meeting scheduled successfully"
        });
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error("💥 API request failed:", error);
      throw error;
    }
  };

  const handleContinueWithoutBuffer = async () => {
    setShowBufferDialog(false);
    setIsSubmitting(true);
    
    try {
      if (pendingFormData) {
        await submitMeeting(pendingFormData);
      }
    } catch (error: any) {
      if (error.message.includes("409")) {
        try {
          const errorData = JSON.parse(error.message.split(": ")[1]);
          setConflictError(errorData);
        } catch {
          setConflictError({
            message: "Meeting conflict detected",
            conflicts: ["Unknown conflict"]
          });
        }
      } else {
        toast({
          title: "Error",
          description: "Failed to save meeting",
          variant: "destructive"
        });
      }
    } finally {
      setIsSubmitting(false);
      setPendingFormData(null);
    }
  };

  const handleCancelBuffer = () => {
    setShowBufferDialog(false);
    setIsSubmitting(false);
    setPendingFormData(null);
    setBufferWarning(null);
  };

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    setConflictError(null);
    setBufferWarning(null);

    console.log("🚀 Form submission started with data:", data);

    // Basic validation
    if (!data.category) {
      toast({
        title: "Validation Error",
        description: "Please select a category for the meeting.",
        variant: "destructive"
      });
      setIsSubmitting(false);
      return;
    }

    if (!data.title.trim()) {
      toast({
        title: "Validation Error", 
        description: "Please enter a meeting title.",
        variant: "destructive"
      });
      setIsSubmitting(false);
      return;
    }

    try {
      const meetingData = {
        title: data.title,
        schedulerName: data.schedulerName || "Unknown",
        category: data.category,
        date: data.date,
        startTime: data.startTime,
        endTime: data.endTime,
        location: data.location || "",
        status: data.status || "confirmed",
        ddfsAttendees: selectedAttendees || [],
        mandatoryAttendees: mandatoryAttendees || [],
        brandAttendees: brandAttendees
          .filter(attendee => attendee.name.trim())
          .map(attendee => JSON.stringify(attendee))
      };

      console.log("📤 Sending meeting data:", meetingData);
      await submitMeeting(meetingData);
      
    } catch (error: any) {
      console.error("❌ Meeting submission error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save meeting",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingMeeting ? "Edit Meeting" : "Schedule New Meeting"}
            </DialogTitle>
          </DialogHeader>
        
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Meeting Title */}
            <div>
            <Label htmlFor="title">Meeting Title</Label>
            <Input 
              id="title"
              {...form.register("title")}
              placeholder="Enter meeting title"
              className="mt-1"
            />
            {form.formState.errors.title && (
              <p className="text-red-500 text-sm mt-1">{form.formState.errors.title.message}</p>
            )}
          </div>
          
          {/* Scheduler Name */}
          <div>
            <Label htmlFor="schedulerName">Scheduler Name</Label>
            <Input 
              id="schedulerName"
              {...form.register("schedulerName")}
              placeholder="Enter your name"
              className="mt-1"
            />
            {form.formState.errors.schedulerName && (
              <p className="text-red-500 text-sm mt-1">{form.formState.errors.schedulerName.message}</p>
            )}
          </div>
          
          {/* Category */}
          <div>
            <Label htmlFor="category">Category</Label>
            <div className="mt-1">
              <select
                id="category"
                value={selectedCategory || ""}
                onChange={(e) => {
                  const value = e.target.value;
                  console.log("🔥 CATEGORY CHANGE EVENT:", value);
                  console.log("🔥 Available options:", availableCategories);
                  setSelectedCategory(value);
                  form.setValue("category", value);
                }}
                className="w-full p-2 border rounded-md bg-white"
                style={{ minHeight: '40px' }}
              >
                <option value="">-- Select Category --</option>
                {availableCategories.length > 0 ? (
                  availableCategories.map((category: any) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))
                ) : (
                  <option value="" disabled>No categories available for your role</option>
                )}
              </select>
              <div className="text-xs text-gray-500 mt-1">
                Debug: Selected="{selectedCategory}", Available={availableCategories.length} categories, User={user?.role}
              </div>
              {availableCategories.length === 0 && (
                <div className="text-xs text-red-500 mt-1">
                  No categories found - check user permissions
                </div>
              )}
            </div>
            {form.formState.errors.category && (
              <p className="text-red-500 text-sm mt-1">{form.formState.errors.category.message}</p>
            )}
          </div>
          
          {/* Date and Time */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="date">Date</Label>
              <Input 
                id="date"
                type="date"
                {...form.register("date")}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="startTime">Start Time</Label>
              <Select value={form.watch("startTime")} onValueChange={(value) => form.setValue("startTime", value)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {timeSlots.map(slot => (
                    <SelectItem key={slot} value={slot}>
                      {format(new Date(`2000-01-01T${slot}:00`), 'h:mm a')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="endTime">End Time</Label>
              <Select value={form.watch("endTime")} onValueChange={(value) => form.setValue("endTime", value)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {timeSlots.map(slot => (
                    <SelectItem key={slot} value={slot}>
                      {format(new Date(`2000-01-01T${slot}:00`), 'h:mm a')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* Timezone Indicator */}
          <div className="text-xs text-gray-500 italic -mt-2">
            * Time set as per {getTimezoneDisplayName(currentTimezone)} as default
          </div>
          
          {/* Location */}
          <div>
            <Label htmlFor="location">Location</Label>
            <Input 
              id="location"
              {...form.register("location")}
              placeholder="Enter meeting location"
              className="mt-1"
            />
          </div>
          
          {/* Meeting Status */}
          <div>
            <Label>Meeting Status</Label>
            <RadioGroup 
              value={form.watch("status")} 
              onValueChange={(value) => form.setValue("status", value as "confirmed" | "tentative")}
              className="flex space-x-4 mt-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="confirmed" id="confirmed" />
                <Label htmlFor="confirmed">Confirmed</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="tentative" id="tentative" />
                <Label htmlFor="tentative">Tentative</Label>
              </div>
            </RadioGroup>
          </div>
          
          {/* DDFS Attendees */}
          <div>
            <Label>DDFS Attendees</Label>
            <div className="mt-2 space-y-3">
              {availableAttendees.length > 0 ? (
                availableAttendees.map(attendee => (
                  <div key={attendee} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">{attendee}</span>
                      <div className="flex items-center space-x-1">
                        <Checkbox 
                          id={`attendee-${attendee}`}
                          checked={selectedAttendees.includes(attendee)}
                          onCheckedChange={(checked) => handleAttendeeToggle(attendee, checked as boolean)}
                          className="h-3 w-3 scale-75"
                        />
                        <Label htmlFor={`attendee-${attendee}`} className="text-xs">Include</Label>
                      </div>
                    </div>
                    {selectedAttendees.includes(attendee) && (
                      <RadioGroup 
                        value={mandatoryAttendees.includes(attendee) ? "mandatory" : "optional"}
                        onValueChange={(value) => handleMandatoryToggle(attendee, value === "mandatory")}
                        className="flex space-x-1"
                      >
                        <div className="flex items-center space-x-0.5">
                          <RadioGroupItem value="mandatory" id={`mandatory-${attendee}`} className="!h-3 !w-3 scale-50" />
                          <Label htmlFor={`mandatory-${attendee}`} className="text-xs">Mandatory</Label>
                        </div>
                        <div className="flex items-center space-x-0.5">
                          <RadioGroupItem value="optional" id={`optional-${attendee}`} className="!h-3 !w-3 scale-50" />
                          <Label htmlFor={`optional-${attendee}`} className="text-xs">Optional</Label>
                        </div>
                      </RadioGroup>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-sm text-gray-500">Please select a category first</div>
              )}
            </div>
          </div>
          
          {/* Brand Attendees */}
          <div>
            <Label>Brand Attendees</Label>
            <div className="mt-2 space-y-3">
              {brandAttendees.map((attendee, index) => (
                <div key={index} className="flex gap-4 p-4 bg-gray-50 rounded-lg">
                  <Input 
                    placeholder="Attendee Name"
                    value={attendee.name}
                    onChange={(e) => updateBrandAttendee(index, "name", e.target.value)}
                    className="flex-1"
                  />
                  <Input 
                    placeholder="Designation"
                    value={attendee.designation}
                    onChange={(e) => updateBrandAttendee(index, "designation", e.target.value)}
                    className="flex-1"
                  />
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="icon"
                    onClick={() => removeBrandAttendee(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" onClick={addBrandAttendee} className="mt-2">
              <Plus className="h-4 w-4 mr-2" />
              Add Brand Attendee
            </Button>
          </div>
          
          {/* Conflict Warning */}
          {conflictError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>{conflictError.message}</strong>
                <br />
                {conflictError.conflicts.length === 1 
                  ? `The following attendee ${conflictError.conflicts[0]} is not available at the chosen time. Please mark attendee as optional.`
                  : `The following attendees ${conflictError.conflicts.join(', ')} are not available at the chosen time. Please mark attendees as optional.`}
              </AlertDescription>
            </Alert>
          )}

          {/* AI Suggestions */}
          {!editingMeeting && (
            <AISuggestions
              title={form.watch("title") || ""}
              duration={(() => {
                const start = form.watch("startTime");
                const end = form.watch("endTime");
                if (start && end) {
                  const startMinutes = parseInt(start.split(':')[0]) * 60 + parseInt(start.split(':')[1]);
                  const endMinutes = parseInt(end.split(':')[0]) * 60 + parseInt(end.split(':')[1]);
                  return endMinutes - startMinutes;
                }
                return 60; // default 1 hour
              })()}
              category={selectedCategory}
              requiredAttendees={mandatoryAttendees}
              preferredDates={[format(selectedDate, 'yyyy-MM-dd')]}
              onSelectTime={(timeSlot) => {
                form.setValue("startTime", timeSlot.startTime);
                form.setValue("endTime", timeSlot.endTime);
                form.setValue("date", timeSlot.date);
              }}
            />
          )}
          
          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : (editingMeeting ? "Update Meeting" : "Schedule Meeting")}
            </Button>
          </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Buffer Violation Confirmation Dialog */}
      <AlertDialog open={showBufferDialog} onOpenChange={setShowBufferDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>No Buffer Between Meetings</AlertDialogTitle>
            <AlertDialogDescription>
              The following mandatory attendees ({bufferWarning?.attendees.join(', ')}) have meetings ending without any buffer.
              <br /><br />
              Do you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelBuffer} disabled={isSubmitting}>
              No, Go Back
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleContinueWithoutBuffer} disabled={isSubmitting}>
              {isSubmitting ? "Scheduling..." : "Yes, Continue"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
