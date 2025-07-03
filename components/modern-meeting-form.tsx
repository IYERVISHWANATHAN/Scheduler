import { useState, useEffect } from "react";
import { format } from "date-fns";
import { X, Clock, Users, MapPin, Calendar, CheckCircle2, AlertCircle, UserPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { WabiSabiCard, WabiSabiButton, WabiSabiInput, WabiSabiBadge } from "./wabi-sabi-layout";

interface ModernMeetingFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  selectedDate: Date;
  selectedTime?: string;
  categories: any[];
  ddfsAttendees: any[];
  editingMeeting?: any;
  schedulingContext?: {date: string, startTime: string, endTime: string} | null;
}

const categoryStyles = {
  liquor: "category-liquor",
  tobacco: "category-tobacco", 
  pnc: "category-pnc",
  confectionary: "category-confectionary",
  fashion: "category-fashion",
  destination: "category-destination"
};

export function ModernMeetingForm({
  open,
  onClose,
  onSuccess,
  selectedDate,
  selectedTime,
  categories,
  ddfsAttendees,
  editingMeeting,
  schedulingContext
}: ModernMeetingFormProps) {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Initialize form data based on editing or scheduling context
  const getInitialFormData = () => {
    if (editingMeeting) {
      // Editing existing meeting
      return {
        title: editingMeeting.title || "",
        schedulerName: editingMeeting.schedulerName || "",
        category: editingMeeting.category || "",
        date: editingMeeting.date || format(selectedDate, 'yyyy-MM-dd'),
        startTime: editingMeeting.startTime || "09:00",
        endTime: editingMeeting.endTime || "10:00",
        location: editingMeeting.location || "",
        ddfsAttendees: editingMeeting.ddfsAttendees || [],
        mandatoryAttendees: editingMeeting.mandatoryAttendees || [],
        brandAttendees: editingMeeting.brandAttendees || []
      };
    } else if (schedulingContext) {
      // Creating new meeting with specific time context
      return {
        title: "",
        schedulerName: "",
        category: "",
        date: schedulingContext.date,
        startTime: schedulingContext.startTime,
        endTime: schedulingContext.endTime,
        location: "",
        ddfsAttendees: [] as string[],
        mandatoryAttendees: [] as string[],
        brandAttendees: [] as { name: string; designation: string }[]
      };
    } else {
      // Default new meeting
      return {
        title: "",
        schedulerName: "",
        category: "",
        date: format(selectedDate, 'yyyy-MM-dd'),
        startTime: selectedTime || "09:00",
        endTime: selectedTime ? format(new Date(`2000-01-01T${selectedTime}:00`).getTime() + 3600000, 'HH:mm') : "10:00",
        location: "",
        ddfsAttendees: [] as string[],
        mandatoryAttendees: [] as string[],
        brandAttendees: [] as { name: string; designation: string }[]
      };
    }
  };

  const [formData, setFormData] = useState(getInitialFormData());
  
  // Initialize form data only once when modal opens
  useEffect(() => {
    if (open) {
      setFormData(getInitialFormData());
      setStep(1);
    }
  }, [open, editingMeeting]);

  // Debug categories prop changes
  useEffect(() => {
    console.log('ModernMeetingForm categories prop changed:', categories, 'length:', categories?.length);
  }, [categories]);

  const { toast } = useToast();

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => {
      const newData = { ...prev, [field]: value };
      
      if (field === 'startTime') {
        const startTime = new Date(`2000-01-01T${value}:00`);
        const endTime = new Date(`2000-01-01T${prev.endTime}:00`);
        const durationMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);
        
        if (durationMinutes < 15) {
          const newEndTime = new Date(startTime.getTime() + 15 * 60 * 1000);
          newData.endTime = newEndTime.toTimeString().slice(0, 5);
        }
      }
      
      return newData;
    });
  };

  const handleAttendeeToggle = (attendeeName: string) => {
    setFormData(prev => {
      const isRemoving = prev.ddfsAttendees.includes(attendeeName);
      return {
        ...prev,
        ddfsAttendees: isRemoving
          ? prev.ddfsAttendees.filter(name => name !== attendeeName)
          : [...prev.ddfsAttendees, attendeeName],
        mandatoryAttendees: isRemoving
          ? prev.mandatoryAttendees.filter(name => name !== attendeeName)
          : prev.mandatoryAttendees
      };
    });
  };

  const handleMandatoryToggle = (attendeeName: string) => {
    setFormData(prev => ({
      ...prev,
      mandatoryAttendees: prev.mandatoryAttendees.includes(attendeeName)
        ? prev.mandatoryAttendees.filter(name => name !== attendeeName)
        : [...prev.mandatoryAttendees, attendeeName]
    }));
  };

  const validateStep = (currentStep: number) => {
    if (currentStep === 1) {
      if (!formData.title.trim()) {
        toast({
          title: "Missing Title",
          description: "Please enter a meeting title",
          variant: "destructive"
        });
        return false;
      }
      if (!formData.category) {
        toast({
          title: "Missing Category",
          description: "Please select a meeting category",
          variant: "destructive"
        });
        return false;
      }
      return true;
    }
    
    if (currentStep === 2) {
      if (formData.mandatoryAttendees.length === 0) {
        toast({
          title: "No Mandatory Attendees",
          description: "Please select at least one mandatory attendee before proceeding",
          variant: "destructive"
        });
        return false;
      }
      return true;
    }
    
    return true;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep(prev => Math.min(prev + 1, 3));
    }
  };

  const handleSubmit = async () => {
    // Validate required fields before submission
    if (!formData.title.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter a meeting title",
        variant: "destructive"
      });
      return;
    }
    
    if (!formData.category) {
      toast({
        title: "Missing Information", 
        description: "Please select a category",
        variant: "destructive"
      });
      return;
    }
    
    if (formData.mandatoryAttendees.length === 0) {
      toast({
        title: "No Mandatory Attendees",
        description: "Please select at least one mandatory attendee before scheduling the meeting",
        variant: "destructive"
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const startTime = new Date(`2000-01-01T${formData.startTime}:00`);
      const endTime = new Date(`2000-01-01T${formData.endTime}:00`);
      const durationMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);

      if (durationMinutes < 15) {
        toast({
          title: "Invalid Duration",
          description: "Meeting must be at least 15 minutes long",
          variant: "destructive"
        });
        return;
      }

      const meetingData = {
        title: formData.title,
        schedulerName: formData.schedulerName || "Unknown",
        category: formData.category,
        date: formData.date,
        startTime: formData.startTime,
        endTime: formData.endTime,
        location: formData.location,
        status: "confirmed",
        ddfsAttendees: formData.ddfsAttendees,
        mandatoryAttendees: formData.mandatoryAttendees,
        brandAttendees: formData.brandAttendees
          .filter(attendee => attendee.name.trim())
          .map(attendee => JSON.stringify(attendee))
      };

      if (editingMeeting) {
        // Update existing meeting
        await apiRequest("PATCH", `/api/meetings/${editingMeeting.id}`, meetingData);
        toast({
          title: "Success",
          description: "Meeting updated successfully"
        });
      } else {
        // Create new meeting
        await apiRequest("POST", "/api/meetings", meetingData);
        toast({
          title: "Success",
          description: "Meeting scheduled successfully"
        });
      }

      onSuccess();
      onClose();
      setStep(1);
      
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create meeting",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const availableAttendees = ddfsAttendees || [];

  if (!open) return null;

  // Additional debug logging
  console.log('ModernMeetingForm rendering with:', {
    open,
    categoriesLength: categories?.length,
    categories: categories
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose}></div>
      
      <WabiSabiCard className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-wabi-stone/10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="wabi-heading text-2xl text-black font-bold">
                {editingMeeting ? 'Edit Meeting' : 'Schedule Meeting'}
              </h2>
              <p className="text-gray-800 text-sm mt-1 font-semibold">Step {step} of 3</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-wabi-sand rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-wabi-stone" />
            </button>
          </div>
          
          {/* Progress Bar */}
          <div className="mt-4 w-full bg-wabi-mist rounded-full h-2">
            <div 
              className="bg-wabi-earth h-2 rounded-full transition-all duration-500"
              style={{ width: `${(step / 3) * 100}%` }}
            ></div>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Step 1: Basic Information */}
          {step === 1 && (
            <div className="space-y-6 wabi-animate-in">
              <div>
                <label className="block text-black text-sm font-bold mb-2">
                  Meeting Title *
                </label>
                <WabiSabiInput
                  value={formData.title}
                  onChange={(e: any) => handleInputChange("title", e.target.value)}
                  placeholder="Enter meeting title"
                />
              </div>

              <div>
                <label className="block text-black text-sm font-bold mb-2">
                  Scheduler Name
                </label>
                <WabiSabiInput
                  value={formData.schedulerName}
                  onChange={(e: any) => handleInputChange("schedulerName", e.target.value)}
                  placeholder="Your name"
                />
              </div>

              <div>
                <label className="block text-black text-sm font-bold mb-3">
                  Category *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {console.log('Categories in form render:', categories, 'open:', open)}
                  {!categories || categories.length === 0 ? (
                    <div className="col-span-2 text-center text-gray-500 p-4 border border-gray-200 rounded-lg">
                      Loading categories...
                    </div>
                  ) : (
                    categories.map((category) => (
                      <button
                        key={category.key}
                        type="button"
                        onClick={() => handleInputChange("category", category.key)}
                        className={`p-4 rounded-xl border-2 text-left transition-all ${
                          formData.category === category.key
                            ? `${categoryStyles[category.key as keyof typeof categoryStyles]} border-current shadow-lg`
                            : "border-wabi-stone/20 hover:border-wabi-stone/40 bg-white"
                        }`}
                      >
                        <div className="font-medium">{category.label}</div>
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-black text-sm font-bold mb-2">
                    Date
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-3 h-4 w-4 text-wabi-stone" />
                    <WabiSabiInput
                      type="date"
                      value={formData.date}
                      onChange={(e: any) => handleInputChange("date", e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-black text-sm font-bold mb-2">
                    Start Time
                  </label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-3 h-4 w-4 text-wabi-stone" />
                    <WabiSabiInput
                      type="time"
                      value={formData.startTime}
                      onChange={(e: any) => handleInputChange("startTime", e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-black text-sm font-bold mb-2">
                    End Time
                  </label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-3 h-4 w-4 text-wabi-stone" />
                    <WabiSabiInput
                      type="time"
                      value={formData.endTime}
                      onChange={(e: any) => handleInputChange("endTime", e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-black text-sm font-bold mb-2">
                  Location
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 h-4 w-4 text-wabi-stone" />
                  <WabiSabiInput
                    value={formData.location}
                    onChange={(e: any) => handleInputChange("location", e.target.value)}
                    placeholder="Meeting location"
                    className="pl-10"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Attendees */}
          {step === 2 && (
            <div className="space-y-6 wabi-animate-in">
              <div className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-wabi-earth" />
                <h3 className="wabi-heading text-lg">Select Attendees</h3>
                <WabiSabiBadge>
                  {formData.ddfsAttendees.length} selected
                </WabiSabiBadge>
              </div>

              {availableAttendees.length > 0 && (
                <div className="space-y-3">
                  {availableAttendees.map((attendee) => (
                    <div
                      key={attendee.id}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        formData.ddfsAttendees.includes(attendee.name)
                          ? "border-wabi-earth bg-wabi-sand/30"
                          : "border-wabi-stone/20 hover:border-wabi-stone/40"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            checked={formData.ddfsAttendees.includes(attendee.name)}
                            onChange={() => handleAttendeeToggle(attendee.name)}
                            className="h-5 w-5 rounded border-wabi-stone/30"
                          />
                          <div>
                            <div className="font-medium text-wabi-charcoal">{attendee.name}</div>
                            <div className="text-sm text-wabi-stone">{attendee.email}</div>
                          </div>
                        </div>
                        
                        {formData.ddfsAttendees.includes(attendee.name) && (
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={formData.mandatoryAttendees.includes(attendee.name)}
                              onChange={() => handleMandatoryToggle(attendee.name)}
                              className="h-4 w-4 text-red-600"
                            />
                            <label className="text-sm font-bold text-black">
                              Mandatory
                            </label>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-6">
                <div className="flex items-center space-x-2 mb-4">
                  <UserPlus className="h-5 w-5 text-wabi-earth" />
                  <h4 className="text-black text-md font-bold">Add Brand Attendees</h4>
                </div>
                
                <div className="space-y-3">
                  {formData.brandAttendees.map((attendee, index) => (
                    <div key={index} className="flex space-x-2">
                      <WabiSabiInput
                        placeholder="Name"
                        value={attendee.name}
                        onChange={(e: any) => {
                          const newBrandAttendees = [...formData.brandAttendees];
                          newBrandAttendees[index].name = e.target.value;
                          setFormData(prev => ({ ...prev, brandAttendees: newBrandAttendees }));
                        }}
                        className="flex-1"
                      />
                      <WabiSabiInput
                        placeholder="Designation"
                        value={attendee.designation}
                        onChange={(e: any) => {
                          const newBrandAttendees = [...formData.brandAttendees];
                          newBrandAttendees[index].designation = e.target.value;
                          setFormData(prev => ({ ...prev, brandAttendees: newBrandAttendees }));
                        }}
                        className="flex-1"
                      />
                      <WabiSabiButton
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const newBrandAttendees = formData.brandAttendees.filter((_, i) => i !== index);
                          setFormData(prev => ({ ...prev, brandAttendees: newBrandAttendees }));
                        }}
                        className="px-3"
                      >
                        ×
                      </WabiSabiButton>
                    </div>
                  ))}
                  
                  <WabiSabiButton
                    variant="outline"
                    onClick={() => {
                      setFormData(prev => ({
                        ...prev,
                        brandAttendees: [...prev.brandAttendees, { name: "", designation: "" }]
                      }));
                    }}
                    className="w-full"
                  >
                    + Add Brand Attendee
                  </WabiSabiButton>
                </div>
              </div>

              <div className="mt-4 p-4 bg-wabi-mist rounded-xl">
                <div className="text-sm text-wabi-stone">
                  DDFS Selected: <span className="font-medium text-wabi-charcoal">{formData.ddfsAttendees.length}</span> |
                  Mandatory: <span className="font-medium text-red-600">{formData.mandatoryAttendees.length}</span> |
                  Brand: <span className="font-medium text-wabi-charcoal">{formData.brandAttendees.length}</span>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Review */}
          {step === 3 && (
            <div className="space-y-6 wabi-animate-in">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <h3 className="wabi-heading text-lg">Review Meeting</h3>
              </div>

              <WabiSabiCard hover={false} className="p-4 bg-wabi-sand/30">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-wabi-stone">Title</div>
                    <div className="font-medium text-wabi-charcoal">{formData.title}</div>
                  </div>
                  <div>
                    <div className="text-sm text-wabi-stone">Category</div>
                    <WabiSabiBadge className={categoryStyles[formData.category as keyof typeof categoryStyles]}>
                      {categories.find(c => c.key === formData.category)?.label}
                    </WabiSabiBadge>
                  </div>
                  <div>
                    <div className="text-sm text-wabi-stone">Date & Time</div>
                    <div className="font-medium text-wabi-charcoal">
                      {format(new Date(formData.date), 'MMM d, yyyy')} | {formData.startTime} - {formData.endTime}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-wabi-stone">Location</div>
                    <div className="font-medium text-wabi-charcoal">{formData.location || "Not specified"}</div>
                  </div>
                </div>
              </WabiSabiCard>

              <div>
                <div className="text-sm text-wabi-stone mb-3">Attendees</div>
                <div className="space-y-2">
                  {formData.ddfsAttendees.map((attendeeName) => (
                    <div key={attendeeName} className="flex items-center justify-between p-3 bg-white rounded-lg border border-wabi-stone/10">
                      <span className="text-wabi-charcoal">{attendeeName}</span>
                      {formData.mandatoryAttendees.includes(attendeeName) && (
                        <WabiSabiBadge className="bg-red-100 text-red-800">Mandatory</WabiSabiBadge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-wabi-stone/10">
          <div className="flex justify-between">
            <WabiSabiButton
              variant="outline"
              onClick={step === 1 ? onClose : () => setStep(prev => prev - 1)}
              className={step === 1 ? "border-red-500 text-red-600 hover:bg-red-50" : ""}
            >
              {step === 1 ? "Cancel" : "Previous"}
            </WabiSabiButton>
            
            {step < 3 ? (
              <WabiSabiButton 
                onClick={handleNext}
                className="bg-green-500 hover:bg-green-600 text-white border-green-500"
              >
                Next
              </WabiSabiButton>
            ) : (
              <WabiSabiButton
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="bg-green-600 hover:bg-green-700"
              >
                {isSubmitting ? "Scheduling..." : "Schedule Meeting"}
              </WabiSabiButton>
            )}
          </div>
        </div>
      </WabiSabiCard>
    </div>
  );
}